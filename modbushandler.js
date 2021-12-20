`use strict`;

var modbus = require('jsmodbus');
const opcua = require("node-opcua");
const Reconnect = require('./NetReconnect')
const net = require('net');
const { errorCodeToMessage } = require('jsmodbus/dist/codes');

class ModbusHandler {
    constructor(host, port, unit) {
        this.modbusclient = {};
        this.socket = {};
        this.ValueMap = {};
        this.socket = new net.Socket();
        var mclient = new modbus.client.TCP(this.socket, unit);
        const options = {
            'host': host,
            'port': port,
            'autoReconnect': true,
            'retryAlways': true,
            'retryTime': 1000,
            'timeout': 5000,
            'keepAlive': 5000
        };
        let recon = new Reconnect(this.socket, options);
        this.socket.connect(options);

        console.log("Created a Modbus device on %s:%d %s", host, port, unit);
        this.modbusclient = mclient;
        let connectionState = false;
        this.socket.on('error', () => {
            if (connectionState)
                console.warn("Lost connection to Modbus device on %s:%d %s", host, port, unit);
            connectionState = false;
        });
        this.socket.on('connect', () => {
            if (!connectionState) {
                console.info("Connection established to Modbus device on %s:%d %s", host, port, unit);
            }
            connectionState = true;
        });
    }


    GetDataTypeString(type) {
        switch (type) {
            case "holdingregister":
            case "inputregisters":
                return "Int32";
            case "coils":
            case "discreteinputs":
                return "Boolean";
        }
    }
    GetDataTypeVarint(type) {
        switch (type) {
            case "holdingregister":
            case "inputregisters":
                return opcua.DataType.Int32;
            case "coils":
            case "discreteinputs":
                return opcua.DataType.Int16.Boolean;
        }
    }
    StartPoll(name, type, address, count, pollrate) {
        this.socket.on('error', () => {
            for (var property in this.ValueMap) {
                if (this.ValueMap.hasOwnProperty(property)) {
                    this.ValueMap[property].q = "bad"
                }
            }
        });
        setInterval(polldata.bind(null, this.socket, this.modbusclient, this.ValueMap, name, type, address, count), pollrate);
    }
    ReadValue(name) {
        //console.log("read ", this.ValueMap);
        var val = this.ValueMap[name];
        let statusCode;
        if (!val) {
            statusCode = opcua.StatusCodes.BadDataUnavailable;
        }
        if (val?.q != "good") {
            switch (val?.q) {
                case "BadNotConnected":
                    statusCode = opcua.StatusCodes.BadNotConnected;
                    break;
                case "BadCommunicationError":
                default:
                    statusCode = opcua.StatusCodes.BadCommunicationError;
                    break;

            }
        }
        return new opcua.DataValue({ "value": val?.v, "statusCode": statusCode, "sourceTimestamp": new Date() });
    }
    async WriteValue(type, address, variant) {
        try {
            switch (type) {
                case "holdingregister": {
                    var value = parseInt(variant.value);
                    let resp = await this.modbusclient.writeSingleRegister(address, value);
                    return true;
                }
                case "coils": {
                    var value = ((variant.value) === 'true');
                    let resp = await this.modbusclient.writeSingleCoil(address, value);
                    return true;
                }
            }
        } catch (er) {
            console.error('unable to write %s', address, er);
        }
        return false;
    }
};

function toOPCType(type) {
    switch (type) {
        case "holdingregister":
        case "inputregisters":
            return opcua.DataType.Int32;
        case "coils":
        case "discreteinputs":
            return opcua.DataType.Boolean;
    }
}

async function read(client, readFunction, rootname, address, count, ValueMap,) {
    try {
        const resp = await client[readFunction](address, count);
        resp.response.body.values.forEach(function (value, i) {
            var fulladdress = (address + i).toString();
            ValueMap[rootname + fulladdress] = {
                v: new opcua.Variant({ dataType: opcua.DataType.Int32, value: value }),
                q: "good"
            };
        });
    } catch (err) {
        for (var i = 0; i < count; ++i) {
            var fulladdress = (address + i).toString();
            ValueMap[rootname + fulladdress] = {
                q: "BadCommunicationError"
            };
        }
        console.error("Unable to read items address: %d count: %d:", address, count, err);
    }
}

async function polldata(socket, client, ValueMap, rootname, type, address, count) {
    try {
        if (socket.readyState != 'open') {
            for (var i = 0; i < count; ++i) {
                var fulladdress = (address + i).toString();
                ValueMap[rootname + fulladdress] = {
                    q: "BadNotConnected"
                };
            }
        } else {

            switch (type) {
                case "holdingregister":
                    await read(client, 'readHoldingRegisters', rootname, address, count, ValueMap);
                    break;
                case "inputregisters":
                    await read(client, 'readInputRegisters', rootname, address, count, ValueMap);
                    break;
                case "coils":
                    await read(client, 'readCoils', rootname, address, count, ValueMap);
                    break;
                case "discreteinputs":
                    await read(client, 'readDiscreteInputs', rootname, address, count, ValueMap);
                    break;
            }
        }
    } catch (err) {
        for (var i = 0; i < count; ++i) {
            var fulladdress = (address + i).toString();
            ValueMap[rootname + fulladdress] = {
                q: "BadCommunicationError"
            };
        }
        console.error("Unable to poll items: ", err);
    }
}
module.exports = ModbusHandler;