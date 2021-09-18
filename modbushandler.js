`use strict`;

var modbus = require('jsmodbus');
var opcua = require("node-opcua");
const net = require('net')

var modbushandler = {
    modbusclient: {},
    socket: {},
    ValueMap: {},
    GetDataTypeString: function (type) {
        switch (type) {
            case "holdingregister":
            case "inputregisters":
                return "Int32";
            case "coils":
            case "discreteinputs":
                return "Boolean";
        }
    },
    GetDataTypeVarint: function (type) {
        switch (type) {
            case "holdingregister":
            case "inputregisters":
                return opcua.DataType.Int32;
            case "coils":
            case "discreteinputs":
                return opcua.DataType.Int16.Boolean;
        }
    },
    StartPoll: function (name, type, address, count, pollrate) {
        this.socket.on('error', () => {
            for (var property in this.ValueMap) {
                if (this.ValueMap.hasOwnProperty(property)) {
                    this.ValueMap[property].q = "bad"
                }
            }
        });
        setInterval(polldata.bind(null, this.modbusclient, this.ValueMap, name, type, address, count), pollrate);
    },
    ReadValue: function (name) {
        //console.log("read ", this.ValueMap);
        var val = this.ValueMap[name];
        if (!val) {
            return opcua.StatusCodes.BadDataUnavailable;
        }
        if (val.q != "good") {
            return opcua.StatusCodes.BadConnectionRejected;//Bad;
        }
        return val.v;
    },
    WriteValue: function (type, address, variant) {
        switch (type) {
            case "holdingregister":
                var value = parseInt(variant.value);
                this.modbusclient.writeSingleRegister(address, value).then(function (resp) {

                    // resp will look like { fc: 6, byteCount: 4, registerAddress: 13, registerValue: 42 } 
                    console.log("Writing to holding register address: " + resp.registerAddress + " value: ", resp.registerValue);

                }).fail(console.log);
                break;
            case "coils":
                var value = ((variant.value) === 'true');
                this.modbusclient.writeSingleCoil(address, value).then(function (resp) {

                    // resp will look like { fc: 5, byteCount: 4, outputAddress: 5, outputValue: true } 
                    console.log("Writing to coil address: " + resp.outputAddress + " value: " + resp.outputValue);

                }).fail(console.log);
                break;
        }
    },
    CreateModbusDevice: function (host, port, unit) {
        this.socket = new net.Socket();
        var mclient = new modbus.client.TCP(this.socket);
        const options = {
            'host': host,
            'port': port,
            'autoReconnect': true,
            'reconnectTimeout': 1000,
            'timeout': 5000,
            'keepAlive': 5000,
            'unitId': unit
        };
        this.socket.connect(options);

        console.log("Created a Modbus device on " + host + ":" + port + " " + unit);
        this.modbusclient = mclient;
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

function polldata(client, ValueMap, rootname, type, address, count) {
    if (this.socket?.readState != 'open') {
        for (var i = 0; i < count; ++i) {
            var fulladdress = (address + i).toString();
            ValueMap[rootname + fulladdress] = {
                v: new opcua.Variant({ dataType: opcua.DataType.Null}),
                q: "BadNotConnected"
            };
        }
    } else {
        try {
            switch (type) {
                case "holdingregister":
                    client.readHoldingRegisters(address, count).then(function (resp) {
                        // resp will look like { fc: 3, byteCount: 20, register: [ values 0 - 10 ], payload: <Buffer> }
                        // console.log(resp);
                        resp.register.forEach(function (value, i) {
                            var fulladdress = (address + i).toString();
                            ValueMap[rootname + fulladdress] = {
                                v: new opcua.Variant({ dataType: opcua.DataType.Int32, value: value }),
                                q: "good"
                            };
                        });
                    });

                    break;
                case "inputregisters":

                    client.readInputRegisters(address, count).then(function (resp) {
                        // resp will look like { fc: 3, byteCount: 20, register: [ values 0 - 10 ], payload: <Buffer> }
                        //console.log(resp);
                        resp.register.forEach(function (value, i) {
                            var fulladdress = (address + i).toString();
                            ValueMap[rootname + fulladdress] = {
                                v: new opcua.Variant({ dataType: opcua.DataType.Int32, value: value }),
                                q: "good"
                            };
                        });
                    });

                    break;
                case "coils":
                    client.readCoils(address, count).then(function (resp) {
                        // resp will look like { fc: 3, byteCount: 20, register: [ values 0 - 10 ], payload: <Buffer> }
                        //console.log(resp);

                        resp.coils.forEach(function (value, i) {
                            var fulladdress = (address + i).toString();
                            ValueMap[rootname + fulladdress] = {
                                v: new opcua.Variant({ dataType: opcua.DataType.Boolean, value: value }),
                                q: "good"
                            };
                        });
                    });//.fail(console.log);
                    break;
                case "discreteinputs":
                    client.readDiscreteInputs(address, count).then(function (resp) {
                        // resp will look like { fc: 3, byteCount: 20, register: [ values 0 - 10 ], payload: <Buffer> }
                        //console.log(resp);
                        resp.coils.forEach(function (value, i) {
                            var fulladdress = (address + i).toString();
                            ValueMap[rootname + fulladdress] = {
                                v: new opcua.Variant({ dataType: opcua.DataType.Boolean, value: value }),
                                q: "good"
                            };
                        });
                    });//.fail(console.log);
                    break;
            }

        } catch (err) {
            for (var i = 0; i < count; ++i) {
                var fulladdress = (address + i).toString();
                ValueMap[rootname + fulladdress] = {
                    v: new opcua.Variant({ dataType: opcua.DataType.Null }),
                    q: "BadCommunicationError"
                };
            }
            console.error("Unable to poll items: " + err);
        }

    }
}
module.exports = modbushandler;