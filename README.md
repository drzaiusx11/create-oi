create-oi: iRobot Create&#174; driver for node
========================================

An API for interacting with an iRobot Create. Because robots are fun.

Description
-----------
The iRobot Create provides a serial API called the "Open Interface" documented [here](http://www.irobot.com/filelibrary/pdfs/hrd/create/Create%20Open%20Interface_v2.pdf).
This library implements that serial protocol in node using the great [serialport](https://github.com/voodootikigod/node-serialport) library.

Prerequisites
-------------
 * Have an iRobot Create 
 * Installed usb-serial drivers and connected laptop, Raspberry Pi, Gumstix or similarly capable machine to your Create
   * see: [Windows installation instructions](http://homesupport.irobot.com/app/answers/detail/a_id/362/~/installing-the-usb-serial-port) if necessary (if using Create USB cable)
 * node and npm are installed on said machine

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
