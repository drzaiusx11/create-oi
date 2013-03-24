create-oi: iRobot Create&#174; driver for node
========================================

An API for interacting with an iRobot Create. Because robots are fun.

Prerequisites
-------------
 * Have an iRobot Create 
 * Installed usb-serial drivers and connected laptop, Raspberry Pi, Gumstix or similarly capable machine to your Create
   * see: [Windows installation instructions](http://homesupport.irobot.com/app/answers/detail/a_id/362/~/installing-the-usb-serial-port) if necessary (if using Create USB cable)
 * node and npm are installed

Installation
------------
```sh
npm install create-oi
```

Usage
-----
```javascript
var robot = require("create-oi");

robot.init({ serialport: "/dev/tty.usbserial-A2001nf6" });

robot.on('ready', function() {
    // start by going forward
    this.drive(100, 0);
});

robot.on('bump', function(e) {
    console.log(e.direction);
    ...
});

```
