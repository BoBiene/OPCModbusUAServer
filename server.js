`use strict`;

const commander = require('commander');
const opcua = require("node-opcua");
const config = require('config');
const modbusHandler = require("./modbushandler");
const { add } = require('lodash');

const processArgs = new commander.Command();
const rangeRexEx = /(\d+)([:](\d+))?/

function parseMyInt(value, dummyPrevious) {
    const parsedValue = parseInt(value, 10);
    if (isNaN(parsedValue)) {
        throw new commander.InvalidArgumentError('Not a number.');
    }
    return parsedValue;
}

function parseMyRange(value, previous) {
    if (rangeRexEx.test(value)) {
        const match = rangeRexEx.exec(value);
        const address = parseInt(match[1]);
        var count = 1;
        if (match[3])
            count = parseInt(match[3]);
        return (previous ?? []).concat({ "address": address, "count": count });
    }
    throw new commander.InvalidArgumentError('Range is invalid, specify <address>:<count> or <address>');
}

processArgs
    .addOption(new commander.Option('-p, --port <number>', 'opc ua server port number').default(config.get('port')).env('PORT').argParser(parseMyInt))
    .addOption(new commander.Option('-u, --url <path>', 'opc ua server url-path').default(config.get('url')).env('URL_PATH'))
    .addOption(new commander.Option('--modbus-host <host>', 'specify the modbus host address').env('MODBUS_HOST'))
    .addOption(new commander.Option('--modbus-port <port>', 'specify the modbus tcp port').default(502).env('MODBUS_PORT').argParser(parseMyInt))
    .addOption(new commander.Option('--modbus-pollrate <pollrate>', 'specify the pollrate in milliseconds').default(1000).env('MODBUS_POLLRATE').argParser(parseMyInt))
    .addOption(new commander.Option('--modbus-unit-id <unitId>', 'specify the modbus unit id').default(1).env('MODBUS_UNITID').argParser(parseMyInt))
    .addOption(new commander.Option('--modbus-not-onebased', 'disable one based addresses'))
    .addOption(new commander.Option('--modbus-holdingregister [ranges...]', 'specify the modbus holdingregister ranges').default([]).argParser(parseMyRange))
    .addOption(new commander.Option('--modbus-coils [ranges...]', 'specify the modbus coils ranges').default([]).argParser(parseMyRange))
    .addOption(new commander.Option('--modbus-discreteinputs [ranges...]', 'specify the modbus discreteinputs ranges').default([]).argParser(parseMyRange))
    .addOption(new commander.Option('--modbus-inputregisters [ranges...]', 'specify the modbus inputregisters ranges').default([]).argParser(parseMyRange))

function registerDeviceToUAServer(server, devicesnode, namespace, device) {
    modbusHandler.CreateModbusDevice(device.modbushost, device.modbusport ?? 502, device.unit ?? 1);
    var dnodefname = device.modbushost + ":" + device.modbusport + " unit: " + device.unit;
    console.log("creating folder: " + dnodefname)
    var dnode = namespace.addFolder(
        devicesnode, { browseName: dnodefname }
    );
    device.deviceaddressspace.forEach(function (info) {
        console.log("Creating folder: " + info.type);
        var registertype = namespace.addFolder(
            dnode, { browseName: info.type }
        );
        info.addresses.forEach(function (ainfo) {
            create_modbus_variables(server, modbusHandler, dnode.browseName + registertype.browseName, registertype, info.type, ainfo.address, ainfo.count, device);
        });
    });
}

function create_modbus_variables(server, modbushandler, rootname, register, type, address, count, device) {
    var StartAddress = address;
    if (device.onebased && address > 0) {
        StartAddress = address - 1;
    } else if (address == 0) {
        console.log("Can not apply the onebased mode with a starting address of 0");
    }
    else if (address < 0) {
        console.log("address is invalid, starting address must be a positive number if in onebased mode, otherwise address can be 0 or more");
        return;
    }
    modbushandler.StartPoll(rootname, type, StartAddress, count, device.pollrate);
    const addressSpace = server.engine.addressSpace;
    const namespace = addressSpace.getOwnNamespace();
 
    for (var i = 0; i < count; i++) {
        //console.log("creating variable: " + (address + count).toString());
        var node = function (register, type, address, i) {
            var servernode = {
                componentOf: register,
                browseName: (address + i).toString().padStart(5, 0),
                minimumSamplingInterval: device.pollrate,
                dataType: modbushandler.GetDataTypeString(type),
                value: {
                    get: function () {
                        return modbushandler.ReadValue(rootname + (StartAddress + i).toString());
                    },
                    set: function (variant) {
                        modbushandler.WriteValue(type, StartAddress + i, variant);
                        return opcua.StatusCodes.Good;
                    }
                }
            }
            return servernode;
        }(register, type, address, i);
        namespace.addVariable(node);
    }
}



(async () => {

    try {
        processArgs.parse();
        const options = processArgs.opts();

        const server = new opcua.OPCUAServer({
            port: options.port,
            resourcePath: options.url,
            buildInfo: {
                productName: "ModbusUAServer",
                buildNumber: "1",
                buildDate: new Date()
            }
        });

        await server.initialize();
        const addressSpace = server.engine.addressSpace;
        const namespace = addressSpace.getOwnNamespace();
        var devicesnode = namespace.addFolder("RootFolder", { browseName: "Modbus Devices" });
        if (config.has('modbusdevices')) {
            config.modbusdevices.forEach(device => registerDeviceToUAServer(server, devicesnode, namespace, device));
        }


        if (options.modbusHost) {
            registerDeviceToUAServer(server, devicesnode, namespace, {
                "modbushost": options.modbusHost,
                "modbusport": options.modbusPort,
                "pollrate" : options.modbusPollrate,
                "unit": options.modbusUnitId,
                "onebased": !!options.modbusNotOnebased,
                "deviceaddressspace": [
                    { "type": "holdingregister", "addresses": options.modbusHoldingregister },
                    { "type": "coils", "addresses": options.modbusCoils },
                    { "type": "discreteinputs", "addresses": options.modbusDiscreteinputs },
                    { "type": "inputregisters", "addresses": options.modbusInputregisters },
                ]
            });
        }

        // we can now start the server
        await server.start();

        console.log('Server is now listening on port %d... ( press CTRL+C to stop) ', options.port);
        server.endpoints[0].endpointDescriptions().forEach(function (endpoint) {
            console.log(endpoint.endpointUrl, endpoint.securityMode.toString(), endpoint.securityPolicyUri.toString());
        });


        process.on("SIGINT", async () => {
            await server.shutdown();
            console.log("terminated");

        });

        // server.initialize(
        //     function () {
        //         console.log("OPC UA Server initialized");
        //         construct_address_space();
        //         server.start(function () {
        //             console.log("Server is now listening...");
        //         });
        //     }
        // );

    } catch (err) {
        console.log(err);
        process.exit(-1);
    }
})();