const assert = require('assert');
const mocha = require('mocha');
const sinon = require('sinon');
const create = require('../src/lib.js');

// mock out the serial port
const _mockSerial = (store) => {
    sinon.stub(create._serial, 'write').callsFake(buff => {
        store.buffer = buff;
    });
    sinon.stub(create._serial, 'drain').callsFake(buff => {}); // no-op
};

describe('sendCommand fault conditions', () => {
    it('dies if called before init', done => {
        assert.throws(() => {
            create.sendCommand(create.cmd.START);
        }, Error, /illegal/);
        done();
    });
});

describe('sendCommand valid inputs', () => {
    let serialStore = { buffer: null };
    before(() => {
        _mockSerial(serialStore);
    });
    after(() => {
        create._serial.write.restore();
        create._serial.drain.restore();
    });

    it('handles one byte commands', done => {
        create.sendCommand(create.cmd.START);
        assert.deepEqual(serialStore.buffer, Buffer.from([ create.cmd.START ]));
        done();
    });

    it('handles multi-byte commands', done => {
        create.sendCommand(create.cmd.DRIVE, [ 10, 20, 30, 40 ]);
        assert.deepEqual(serialStore.buffer, Buffer.from([ create.cmd.DRIVE, 10, 20, 30, 40]));
        done();
    });
});
