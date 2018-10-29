const assert = require('assert');
const mocha = require('mocha');
const sinon = require('sinon');
const create = require('../bin/main.js');

describe('sendCommand', () => {

    let serialBytes;
    sinon.stub(create._serial, 'write').callsFake(buff => {
        serialBytes = buff;
    });

    it('handles one byte commands', (done) => {
        create.sendCommand(create.cmd.START);
        assert.deepEqual(serialBytes, Buffer.from([ create.cmd.START ]));
        done();
    });

    it('handles multi-byte commands', (done) => {
        create.sendCommand(create.cmd.DRIVE, [ 10, 20, 30, 40 ]);
        assert.deepEqual(serialBytes, Buffer.from([ create.cmd.DRIVE, 10, 20, 30, 40]));
        done();
    });
});
