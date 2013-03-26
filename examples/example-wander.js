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
        case 'forward': // randomly choose a direction
            var dir = [-1,1][Math.round(Math.random())];
            this.rotate(dir*100);
            this.wait(2100);
            break;
        case 'left':
            this.rotate(-100); // turn right
            this.wait(1000);
            break;
        case 'right':
            this.rotate(100); // turn left 
            this.wait(1000);
            break;
    }

    // onward!
    this.drive(100, 0);
});
