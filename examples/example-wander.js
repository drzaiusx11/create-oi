
var robot = require("create-oi");

robot.init({ serialport: "/dev/tty.usbserial-A2001nf6" });

robot.on('ready', function() {
    // start by going forward
    this.drive(100, 0);
});

robot.on('bump', function(e) {
    // backup a bit
    this.drive(-100, 0);
    this.wait(1000);

    // turn based on which bumper sensor got hit
    switch(e.direction) {
        case 'forward': // fall through as 'left'
        case 'left':
            this.drive(-100, 1); // turn right for a bit
            this.wait(1000);
            break;
        case 'right':
            this.drive(100, 1); // turn left for a bit
            this.wait(1000);
            break;
    }

    // onward!
    this.drive(100, 0);
});
