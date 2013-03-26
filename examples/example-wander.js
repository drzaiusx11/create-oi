var SPEED = 100; // 100mm/s
var robot = require("create-oi");

robot.init({ serialport: "/dev/tty.usbserial-A2001nf6" });

robot.on('ready', function() {
    // start by going forward
    this.drive(SPEED, 0);
});

var bumpHndlr = function(bumperEvt) {
    var r = this;
    
    // temporarily disable further bump events
    // getting multiple bump events while one is in progress
    // will cause weird interleaving of our robot behavior 
    r.off('bump');

    // backup a bit
    r.drive(-SPEED, 0);
    r.wait(1000);

    // turn based on which bumper sensor got hit
    switch(bumperEvt.which) {
        case 'forward': // randomly choose a direction
            var dir = [-1,1][Math.round(Math.random())];
            r.rotate(dir*SPEED);
            r.wait(2100); // time is in ms
            break;
        case 'left':
            r.rotate(-SPEED); // turn right
            r.wait(1000);
            break;
        case 'right':
            r.rotate(SPEED); // turn left 
            r.wait(1000);
            break;
    }

    // onward!
    r.drive(SPEED, 0)
    .then(function() {
        // turn handler back on
        r.on('bump', bumpHndlr);
    });
};

robot.on('bump', bumpHndlr);
