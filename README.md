create-oi: iRobot Create&#174; driver for node
========================================

An API for interacting with an iRobot Create robot. Because robots are fun.

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
