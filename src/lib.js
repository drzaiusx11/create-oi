var create = (function() {
    var module = {};
    var SerialPort = require("serialport");
    var emitter = require('events').EventEmitter;
    var eventer = new emitter();
    var DRV_FWD_RAD = 0x7fff;
    var serial;
    var watchdog = false;
    var create1Baudrate = 57600;
    var create2Baudrate = 115200;

    var cmds = {
        START:          0x80,
        SAFE:           0x83,
        DRIVE:          0x89,
        DRIVE_DIRECT:   0x91,
        LED:            0x8B,
        SONG:           0x8C,
        PLAY:           0x8D,
        STREAM:         0x94,
        SENSORS:        0x8E
    };

    module.cmd = cmds;

    var sensors = {
        BUMP_WDROP: 7,
        WALL:       8,
        BUTTONS:    18,
        DISTANCE:   19,
        ANGLE:      20,
        VOLTAGE:    22
    };

    module.sensor = sensors;

    // helpers
    let uInt16 = n => {
          return n & 0xffff;
    }

    let twosComp = word => {
        return uInt16(~word + 1);
    };

    let uB = function(n) {
        return n >> 8;
    };

    let lB = function(n) {
        return n & 0xff;
    };

    let distance = 0;
    let angle = 0;
    let pkt = []; // stores working packet data

    function seek(buffer) {
        for (var i = 0; i < buffer.length; i++) {
            if (buffer[i] === START_BYTE)
                return i;
        }
        return -1;
    }

    var ldata = 0;
    var LEN_IDX = 1;
    var START_BYTE = 0x13;

    function bumperIdxToName(idx) {
        switch(idx) {
            case 1: return "right";
            case 2: return "left";
            case 3: return "forward";
        }
    }

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
                        var data = currPkt[idx+1];
                        // bumper hit!
                        if (data > 0 && data < 4) {
                            if (ldata === 0) {
                                eventer.emit('bump', { which: bumperIdxToName(data) });
                            }
                        }
                        if (ldata != 0 && data === 0)
                            eventer.emit('bumpend', { which: bumperIdxToName(ldata) });
                        // wheeldrop occured!
                        if (data > 0 && data > 4) {
                            if (ldata != data) {
                                eventer.emit('wheeldrop');
                            }
                        }
                        ldata = data;
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
            ;//console.log("WARN: incomming packet failed checksum");
        }
        pkt = []; // clear pkt buff contents
    }

    module.sendCommand = function(cmd, payload) {
        // note: write() is non-blocking but drain() is blocking
        if (typeof payload === "undefined") {
            module._serial.write(new Buffer([cmd]));
        } else {
            module._serial.write(new Buffer([cmd].concat(payload)));
        }
        module._serial.drain();
    }

    function initCreate() {
        module.sendCommand(cmds.START);
        module.sendCommand(cmds.SAFE);
        module.sendCommand(cmds.SONG, [0, 1, 72, 10]);
        module.sendCommand(cmds.PLAY, [0]);
        module.sendCommand(cmds.STREAM, [3, 7, 19, 20]);
        module.sendCommand(cmds.LED, [8, 0, 255]);
        eventer.emit('ready');
    }

    const uninitializedErrMsg = "illegal attempt to communicate with robot before init() was called, aborting";

    // have skeleton in place before init() is called
    module._serial = {
        write: (b) => {
            throw new Error(uninitializedErrMsg);
        },
        drain: () => {
            throw new Error(uninitializedErrMsg);
        },
    };

    module.init = function(settings) {
        module._serial = new SerialPort(settings.serialport, {
          baudRate: settings.version === 2 ? create2Baudrate : create1Baudrate, 
          bufferSize: 5
        });

        // internal serial event handlers
        module._serial.on('data', function (data) {
            watchdog = true;
            parse(data);
        });

        module._serial.on('close', function (err) {
            console.log('serial port closed');
        });

        module._serial.on('error', function (err) {
            console.error("error", err);
        });

        module._serial.on('open', function() {
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
        return distance;
    };

    module.getAngle = function() {
        return angle;
    };

    module.drive = function(fwd,rad) {
        module.sendCommand(cmds.SAFE);
        if (Math.abs(rad) < 0.0001) {
           rad = DRV_FWD_RAD;
        }
        module.sendCommand(cmds.DRIVE, [uB(twosComp(fwd)), lB(twosComp(fwd)), uB(twosComp(rad)), lB(twosComp(rad))]);
    };

    module.driveDirect = function(rightWeel,leftWeel) {
        module.sendCommand(cmds.SAFE);
        module.sendCommand(cmds.DRIVE_DIRECT, [uB(rightWeel), lB(rightWeel), uB(leftWeel), lB(leftWeel)]);
    };

    module.rotate = function(vel) {
        return module.drive(vel, 1);
    };

    module.wait = function(ms) {
        return new Promise((resolve,reject) => {
            setTimeout(resolve, ms);
        });
    };

    module.on = function(evt, cb) {
        eventer.on(evt, function(e) {
            // set context to module, call it
            cb.call(module, e);
        });
    };

    module.off = function(evt) {
        eventer.removeAllListeners(evt);
    };

    // expose module to the REPL's context
    module.repl = () => {
        var repl = require("repl");
        var local = repl.start({ prompt: "create-oi> ", ignoreUndefined: true});
        for(let prop in module) {
            if (module.hasOwnProperty(prop)) {
                local.context[prop] = module[prop];
            }
        }
    };

    return module;
}());

module.exports = create;
