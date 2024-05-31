const fz = require('zigbee-herdsman-converters/converters/fromZigbee');
const tz = require('zigbee-herdsman-converters/converters/toZigbee');
const exposes = require('zigbee-herdsman-converters/lib/exposes');
const reporting = require('zigbee-herdsman-converters/lib/reporting');
const modernExtend = require('zigbee-herdsman-converters/lib/modernExtend');
const e = exposes.presets;
const ea = exposes.access;
const tuya = require('zigbee-herdsman-converters/lib/tuya');
const legacy = require('zigbee-herdsman-converters/lib/legacy');

const fz2 = {
    awow_thermostat: {
        cluster: 'manuSpecificTuya',
        type: ['commandDataResponse', 'commandDataReport'],
        convert: (model, msg, publish, options, meta) => {
            
            for (const dpValue of msg.data.dpValues) {
            
            const value = legacy.getDataValue(dpValue);
                meta.logger.info(`awow_thermostat  dp #${dpValue.dp} value #${JSON.stringify(msg.data)} ${msg.data}`);
            switch (dpValue.dp) {
            case 2:
                const modes = {0: 'auto', 1: 'manual', 2: 'away'};
                var away_mode = 'OFF';
                if (value == 2) {
                    away_mode = 'ON';
                }
                return {system_mode: modes[value], away_mode: away_mode};

            case 16: //HeatingSetpoint
                const result = {};    
                if(value == 60)
                    result.system_mode = 'heat';
                else if (value == 0)
                    result.system_mode = 'off';
                result.current_heating_setpoint = (value / 2).toFixed(1);
                return result;
                
            case 24:
                return {local_temperature: (value / 10).toFixed(1)};

            case 30:
                    return {child_lock: value ? 'LOCK' : 'UNLOCK'};
    
            case 34:
                return {voltage: (value / 0.05).toFixed(1), battery: ((value / 0.05) - 2100) / 10}; //probably incorect

            case 101: //heat temperature
                return {heat_temperature: (value / 2).toFixed(1)};

            case 102: //away temperature
                return {away_temperature: (value / 2).toFixed(1)};

            //case 103: need fine value: [19,1,1,0,0,34,0,0]

            case 105:
                return {current_heating_setpoint_auto: (value / 2).toFixed(1)};

            case 106: //close 118 countdown
                return {timer: value};
            
            //case 107: //need fine value [0]

            case 116:
                return {open_window_temperature: value / 2};
    
            case 117:
                return {open_window_time: value};
    
            case 118:
                return {boost_time: value};

            case 109: // mon "data":[1,34,24,42,36,34,68,42,92,34,96,42,96,34,96,42,96,34]
            //case 110: something related data":[2,34,24,42,36,34,68,42,92,34,96,42,96,34,96,42,96,34]
            // case 111: data":[3,34,24,42,36,34,68,42,92,34,96,42,96,34,96,42,96,34]
            //case 112: "data":[4,34,24,42,36,34,68,42,92,34,96,42,96,34,96,42,96,34]
            //case 113: "data":[5,34,24,42,36,34,68,42,92,34,96,42,96,34,96,42,96,34]
            case 114: // week "data":[6,34,24,42,36,34,68,42,92,34,96,42,96,34,96,42,96,34]
            case 115: // sun "data":[7,34,24,42,36,34,68,42,92,34,96,42,96,34,96,42,96,34]
                const days = {0: '???', 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday', 6: 'Saturday', 7: 'Sunday'};

                //  SUN 20  6:00 21  9:00 22  10:00 23  23:00 17  24:00

                // [7,  40, 24,  42, 36,  44, 40,   46, 92,   34, 96,    42,96,34,96,42,96,34]
                //   1,   34, 24,  42,36,34,68,42,92,34,96,42,96,34,96,    42,96,34,96,42,96,34

                if (value[0] == 7) {

                    return {
                        program_sunday: {
                            sunday: [
                                '0h:0m ' + value[1] / 2 + '°C',
                                '' + parseInt(value[2] / 4) + 'h:' + (value[2] - parseInt(value[2])) * 15 + 'm ' + value[3] / 2 + '°C',
                                '' + parseInt(value[4] / 4) + 'h:' + (value[4] - parseInt(value[4])) * 15 + 'm ' + value[5] / 2 + '°C',
                                '' + parseInt(value[6] / 4) + 'h:' + (value[6] - parseInt(value[6])) * 15 + 'm ' + value[7] / 2 + '°C',
                                '' + parseInt(value[8] / 4) + 'h:' + (value[8] - parseInt(value[8])) * 15 + 'm ' + value[9] / 2 + '°C',
                                '' + parseInt(value[10] / 4) + 'h:' + (value[10] - parseInt(value[10])) * 15 + 'm ' + value[11] / 2 + '°C',
                            ]
                        },
                    }
                }

            default:
                meta.logger.info(`zigbee-herdsman-converters:AwowThermostat: NOT RECOGNIZED DP #${
                    dpValue.dp} with data ${JSON.stringify(msg.data)} ${msg.data}`); // This will cause zigbee2mqtt to print similar data to what is dumped in tuya.dump.txt
            }    
                
            }
        },
    },
}

const tz2 = {
    awow_thermostat_lock: {
        key: ['child_lock'],
        convertSet: async (entity, key, value, meta) => {
            var lock = 0;
            if (value == 'LOCK') {
                lock = 1;
            }
            await tuya.sendDataPointRaw(entity, 30, [lock]);
        },
    },
    awow_thermostat_current_heating_setpoint_auto: {
        key: ['current_heating_setpoint_auto'],
        convertSet: async (entity, key, value, meta) => {
            const temp = parseInt(value * 2);
            await tuya.sendDataPointRaw(entity, 105, [0, 0 ,0, temp]);
        },
    },
    awow_thermostat_current_heating_setpoint: {
        key: ['current_heating_setpoint'],
        // set manual mode
        convertSet: async (entity, key, value, meta) => {
            const temp = parseInt(value * 2);
            await tuya.sendDataPointRaw(entity, 16, [0, 0 ,0, temp]);
            await tuya.sendDataPointRaw(entity, 2, [1]);
        },
    },
    awow_thermostat_current_mode: {
        key: ['system_mode'],
        convertSet: async (entity, key, value, meta) => {

            switch (value) {
            case 'auto':
                await tuya.sendDataPointRaw(entity, 2, [0]);
                break;
            case 'heat':
                await tuya.sendDataPointRaw(entity, 16, [0, 0 ,0, 60]);
                await tuya.sendDataPointRaw(entity, 2, [1]);
                //await tuya.sendDataPointRaw(entity, 2, [1]);
                break;
            case 'off':
                await tuya.sendDataPointRaw(entity, 16, [0, 0 ,0, 0]);
                await tuya.sendDataPointRaw(entity, 2, [1]);
                //await tuya.sendDataPointRaw(entity, 2, [2]);
                break;
            default:
                meta.logger.info(`awow_thermostat_current_mode  value #${value}`);
            }

        },
    },
    awow_thermostat_open_window_temperature: {
        key: ['open_window_temperature'],
        convertSet: async (entity, key, value, meta) => {
            const temp = parseInt(value * 2);
            await tuya.sendDataPointRaw(entity, 116, [0, 0 ,0, temp]);
        },
    },
}

const definition = {
    zigbeeModel: ['TS0601'],
    model: 'TS0601',
    vendor: '_TZE200_thbr5z34',
    description: 'Thermostatic radiator valve',
    extend: [],
    meta: {},
    onEvent: tuya.setTime,
    fromZigbee: [
        fz.ignore_basic_report,
        //fz.tuya_data_point_dump,
        fz2.awow_thermostat,
        //fz.ignore_tuya_set_time,
    ],
    toZigbee: [
//        tz.tuya_data_point_test,
        tz2.awow_thermostat_current_heating_setpoint_auto,
        tz2.awow_thermostat_current_heating_setpoint,
        tz2.awow_thermostat_current_mode,
        tz2.awow_thermostat_lock,
        tz2.awow_thermostat_open_window_temperature,
    ],
    configure: async (device, coordinatorEndpoint, logger) => {
        const endpoint = device.getEndpoint(1);
        await reporting.bind(endpoint, coordinatorEndpoint, ['genBasic']);
    },
    exposes: [
        exposes.climate()
            .withSetpoint('current_heating_setpoint', 0.5, 29.5, 0.5, ea.STATE_SET)
            .withLocalTemperature(ea.STATE)
            .withSystemMode(['auto', 'heat', 'off'], ea.STATE),
        e.battery_voltage(), 
        e.battery(),
        e.child_lock(),
        e.open_window_temperature().withValueMin(5).withValueMax(30),
    ],
};

module.exports = definition;