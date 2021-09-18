# OPCModbusUAServer

![An OPC server](https://github.com/minaandrawos/OPCModbusUAServer/blob/master/opc%20basics%20cropped.png)

An open source OPC UA server for Modbus TCP devices. The project makes use of the powerful open source NodeOPCUA (http://node-opcua.github.io/) package, combined with the jsmodbus (https://github.com/Cloud-Automation/node-modbus) package to build the OPC server.

If you are not familiar with OPC, it's worth reading this: http://www.minaandrawos.com/2016/12/18/thoughts_industrial_opc/, if not familiar with Modbus, then this would be another good read: http://www.minaandrawos.com/2014/11/26/how-to-write-a-modbus-driver/#WhatIsModbus 

----------

Main files in the project:

 - server.js => The entry point for the application, creates the OPC UA server, initializes the address space, and links to Modbus actions
 - modbushandler.js => Contains the Modbus communication code needed to provide Modbus actions like reads and writes for the OPC server
 - config.json => Configuration file for the application, this is how we get to know the TCP addresses of the Modbus devices, the registers we'd like to read...etc

# Docker container

## sample modbus device using command line arguments
### usage 
````
Usage: server [options]

Options:
  -p, --port <number>                   opc ua server port number (default: 8080, env: PORT)
  -u, --url <path>                      opc ua server url-path (default: "/ModbusServer", env: URL_PATH)
  --modbus-host <host>                  specify the modbus host address (env: MODBUS_HOST)
  --modbus-port <port>                  specify the modbus tcp port (default: "502", env: MODBUS_PORT)
  --modbus-unit-id <unitId>             specify the modbus unit id (default: "1", env: MODBUS_UNITID)
  --modbus-not-onebased                 disable one based addresses
  --modbus-holdingregister [ranges...]  specify the modbus holdingregister ranges (default: [])
  --modbus-coils [ranges...]            specify the modbus coils ranges (default: [])
  --modbus-discreteinputs [ranges...]   specify the modbus discreteinputs ranges (default: [])
  --modbus-inputregisters [ranges...]   specify the modbus inputregisters ranges (default: [])
  -h, --help                            display help for command
````

````bash
docker run -p 8080:8080 ghcr.io/bobiene/opcmodbusuaserver:latest --modbus-host localhost --modbus-holdingregister 1:5 10 50:20
````

````bash
docker run -p 8080:8080 ghcr.io/bobiene/opcmodbusuaserver:latest --modbus-host localhost --modbus-holdingregister 1:5 10 --modbus-holdingregister 50:20
````

````bash
docker run -p 8080:8080 ghcr.io/bobiene/opcmodbusuaserver:latest --modbus-host localhost --modbus.port 503 --modbus-holdingregister 1:5 10 --modbus-discreteinputs 50:20
````

## sample modbus device connection using config file


````bash
docker run -p 8080:8080 -v ./local.json:/usr/src/app/config/local.json ghcr.io/bobiene/opcmodbusuaserver:latest
````

local.json:
````json
{
    "modbusdevices": [
        {
            "modbushost": "localhost",
            "modbusport": 8880,
            "unit": 2,
            "pollrate":500,
            "onebased":true,
            "deviceaddressspace": [
                {
                    "type": "holdingregister",
                    "addresses": [
                        {
                            "address": 1,
                            "count": 4
                        },
                        {
                            "address": 10,
                            "count": 8
                        }
                    ]
                },
                {
                    "type": "coils",
                    "addresses": [
                        {
                            "address": 1,
                            "count": 4
                        },
                        {
                            "address": 10,
                            "count": 8
                        }
                    ]
                },
                {
                    "type": "discreteinputs",
                    "addresses": [
                        {
                            "address": 1,
                            "count": 4
                        },
                        {
                            "address": 10,
                            "count": 8
                        }
                    ]
                },
                {
                    "type": "inputregisters",
                    "addresses": [
                        {
                            "address": 1,
                            "count": 4
                        },
                        {
                            "address": 10,
                            "count": 8
                        }
                    ]
                }
            ]
        }
    ]
}
````