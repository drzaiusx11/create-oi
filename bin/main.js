var create = (function() {
    var module = {};
    var SerialPort = require("serialport").SerialPort;
    var emitter = require('events').EventEmitter;
    var eventer = new emitter();
    var Q = require("q");
    var DRV_FWD_RAD = 0x7fff;
    var prior = Q.resolve();
    var mode = "SAFE";
    var serial;
    var watchdog = false;

    var cmds = {
        START:  0x80,
        SAFE:   0x83,
        DRIVE:  0x89,
        LED:    0x8B,
        SONG:   0x8C,
        PLAY:   0x8D,
        STREAM: 0x94
    };

    var sensors = { 
        BUMP_WDROP: 7,
        WALL:       8,
        BUTTONS:    18,
        DISTANCE:   19,
        ANGLE:      20,
        VOLTAGE:    22
    };

    // helpers

    var uB = function(word) {
        return word >> 8;
    };

    var lB = function(word) {
        return word & 0x000000ff;
    };

    var distance = 0;
    var angle = 0;
    var pkt = []; // stores working packet data

    function seek(buffer) {
        for (var i = 0; i < buffer.length; i++) {
            if (buffer[i] === START_BYTE)
                return i;
        }
        return -1;
    }

    var lmask = 0;
    var LEN_IDX = 1;
    var START_BYTE = 0x13;

    function parse(buffer) {
        // index to start reading packet 
        // data, default to invalid value
        var start = -1;  

        if (pkt.length === 0) 
            start = seek(buffer);
        else 
            start = 0; // we already have the header stored in pkt, read full buff

        if (start === -1) // couldn't seek to START_BYTE
            return;    

        for (var i = start; i < buffer.length; i++) 
            pkt.push(buffer[i]);

        if (buffer.length < start + 2) // LEN_IDX can't be read yet
            return; 

        // START_BYTE found, but not actually start of pkt
        if (buffer[start+1] === 0) { 
            pkt = [];
            return;
        }

        // +3 due to START byte, COUNT byte & CHKSUM bytes included with all pkts
        if (pkt.length < (pkt[LEN_IDX] + 3))
            return;
        
        // extract one whole packet from pkt buffer
        var currPkt = pkt.splice(0,pkt[LEN_IDX]+3);

        var chksum = 0;
        for (var i = 0; i < currPkt.length; i++) 
            chksum += currPkt[i];

        chksum = chksum & 0xff;

        if (chksum == 0) {
            var idx = 2;
            var sensorMsgsParsed = 0;
            while (idx < currPkt.length - 1) {
                switch (currPkt[idx]) {
                    case sensors.BUMP_WDROP:
                        var mask = currPkt[idx+1];
                        // bumper hit!
                        if (mask > 0 && mask < 4) {
                            var e = {};
                            if (mask === 1)
                                e.direction = "right";
                            if (mask === 2)
                                e.direction = "left";
                            if (mask === 3)
                                e.direction = "forward";
                            if (lmask === 0) {
                                eventer.emit('bump', e);
                            }
                        }
                        // wheeldrop occured!
                        if (mask > 0 && mask > 4) {
                            if (lmask != mask) {
                                eventer.emit('wheeldrop');
                            }
                        }
                        lmask = mask;
                        idx += 2;
                        sensorMsgsParsed++;
                    break;
                    case sensors.DISTANCE:
                        var val = (currPkt[idx+1] << 8) | currPkt[idx+2];
                        if (val > 32767) {
                            val -= 65536;
                        }
                        distance += val;
                        idx += 3;
                        sensorMsgsParsed++;
                    break;
                    case sensors.ANGLE:
                        var val = (currPkt[idx+1] << 8) | currPkt[idx+2];
                        if (val > 32767) {
                            val -= 65536;
                        }
                        angle += val;
                        idx += 3;
                        sensorMsgsParsed++;
                    break;
                    default:
                        console.log("WARN: couldn't parse incomming OI pkt");
                        idx++; // prevents inf loop
                }
            }
        } else {
            console.log("WARN: incomming packet failed checksum");
        }
        pkt = []; // clear pkt buff contents
    }

    function sendCommand(cmd, payload) {
        if (typeof payload === "undefined") {
            serial.write(new Buffer([cmd]));
        } else {
            serial.write(new Buffer([cmd].concat(payload)));
        }
        serial.flush();
    }

    function initCreate() {
        sendCommand(cmds.START);
        module.wait(100)
        .then(function() {
            sendCommand(cmds.SAFE);
            return 100; // wait amount
        })
        .then(module.wait)
        .then(function() {
            // set song 0 to single beep
            sendCommand(cmds.SONG, [0x0, 0x01, 72, 10]);
            return 100;
        })
        .then(module.wait)
        .then(function() {
            // play song 0 
            sendCommand(cmds.PLAY, [0x0]);
            return 100;
        })
        .then(module.wait)
        .then(function() {
            sendCommand(cmds.STREAM, [3, 7, 19, 20]);
            return 100;
        })
        .then(module.wait)
        .then(function() {
            // turn power LED on (and green)
            sendCommand(cmds.LED, [8, 0, 255]);
            return 100;
        })
        .then(module.wait)
        .then(function() {
            eventer.emit('ready');
        });
    }

    // exported methods

    module.modes = {
        OFF:     "OFF",
        PASSIVE: "PASSIVE",
        SAFE:    "SAFE",
        FULL:    "FULL"
    };

    module.init = function(settings) {
        serial = new SerialPort(settings.serialport, { baudrate: 57600, bufferSize: 5 });

        // internal serial event handlers

        serial.on('data', function (data) {
            watchdog = true;
            parse(data);
        });

        serial.on('close', function (err) {
            console.log('serial port closed');
        });

        serial.on('error', function (err) {
            console.error("error", err);
        });

        serial.on('open', function() {
            console.log('serial port opened successfully');
            initCreate();
            setInterval(function() {
                if (watchdog === false) {
                    console.log('no data received from create... attempting to connect (again)');
                    initCreate();
                }
                watchdog = false;
            }, 2000);
        });
    }; 

    module.getDistance = function() {
        prior = prior.then(function() {
            console.log(distance);
            return distance;
        });
        return prior;
    };

    module.getAngle = function() {
        prior = prior.then(function() {
            console.log(angle);
            return angle;
        });
        return prior;
    };

    module.drive = function(fwd,rad) {
        prior = prior.then(function() {
            sendCommand(cmds.SAFE);
            if (Math.abs(rad) < 0.0001) {
               rad = DRV_FWD_RAD;
            }
            sendCommand(cmds.DRIVE, [uB(fwd), lB(fwd), uB(rad), lB(rad)]);
            return Q.resolve();
        });
        return prior;
    };

    module.rotate = function(vel) {
        return module.drive(vel, 1);
    };

    module.wait = function(ms) {
        prior = prior.then(function() {
            var deferred = Q.defer();
            setTimeout(deferred.resolve, ms);
            return deferred.promise
        });
        return prior;
    };

    module.setMode = function(m) {
        mode = m;
        sendCommand(mode);
    };
    
    module.getMode = function() {
        return mode;
    };

    module.on = function(evt, cb) {
        eventer.on(evt, function(e) {
            // don't care what we have queued up, clear it!
            //prior = Q.resolve();
            // set context to module, call it
            cb.call(module, e); 
        });
    };

    // expose functions to the REPL's context
    // uncomment for REPL use
    /*
    var repl = require("repl");
    var local = repl.start({ prompt: "robot> ", ignoreUndefined: true});
    local.context.drive = module.drive;
    local.context.wait = module.wait;
    local.context.setMode = module.setMode;
    local.context.getMode = module.getMode;
    local.context.getDistance = module.getDistance;
    local.context.getAngle = module.getAngle;
    local.context.on = module.on;
    local.context.init = module.init;
    local.context.rotate = module.rotate;
    */

    return module;
}());

module.exports = create;
