// Tested with Zigbee2MQTT 1.37.1-1
const fz = require('zigbee-herdsman-converters/converters/fromZigbee');
const tz = require('zigbee-herdsman-converters/converters/toZigbee');
const exposes = require('zigbee-herdsman-converters/lib/exposes');
const reporting = require('zigbee-herdsman-converters/lib/reporting');
const modernExtend = require('zigbee-herdsman-converters/lib/modernExtend');
const e = exposes.presets;
const ea = exposes.access;
const tuya = require('zigbee-herdsman-converters/lib/tuya');
const legacy = require('zigbee-herdsman-converters/lib/legacy');
const thermostat_modes = {0: 'auto', 1: 'manual', 2: 'away'}; 

const tuyaDeviceCode = {
    dataPoints: {
    sh4Mode: 2,
    sh4HeatingSetpoint: 16,
    sh4LocalTemp: 24,
    sh4ChildLock: 30,
    sh4Battery: 34,
    sh4FaultCode: 45,
    sh4ComfortTemp: 101,
    sh4EcoTemp: 102,
    sh4VacationPeriod: 103,
    sh4TempCalibration: 104,
    sh4ScheduleTempOverride: 105,
    sh4RapidHeating: 106,
    sh4WindowStatus: 107,
    sh4Hibernate: 108,
    sh4ScheduleMon: 109,
    sh4ScheduleTue: 110,
    sh4ScheduleWed: 111,
    sh4ScheduleThu: 112,
    sh4ScheduleFri: 113,
    sh4ScheduleSat: 114,
    sh4ScheduleSun: 115,
    sh4OpenWindowTemp: 116,
    sh4OpenWindowTime: 117,
    sh4RapidHeatCntdownTimer: 118,
    sh4TempControl: 119,
    sh4RequestUpdate: 120,
    },
};

const fz2 = {
    awow_thermostat: {
        cluster: 'manuSpecificTuya',
        type: ['commandDataResponse', 'commandDataReport'],
        convert: (model, msg, publish, options, meta) => {
            
            for (const dpValue of msg.data.dpValues) {
            
            const value = legacy.getDataValue(dpValue);
            switch (dpValue.dp) {
            case tuyaDeviceCode.dataPoints.sh4Mode:
                var away_mode = 'OFF';
                if (value == 2) {
                    away_mode = 'ON';
                }
                return {thermostat_mode: thermostat_modes[value], system_mode: thermostat_modes[value], away_mode: away_mode};

            case tuyaDeviceCode.dataPoints.sh4HeatingSetpoint:
                const result = {};    
                if(value == 60)
                    result.system_mode = 'heat';
                else if (value == 0)
                    result.system_mode = 'off';
                result.current_heating_setpoint = (value / 2).toFixed(1);
                return result;
                
            case tuyaDeviceCode.dataPoints.sh4LocalTemp:
                return {local_temperature: (value / 10).toFixed(1)};

            case tuyaDeviceCode.dataPoints.sh4ChildLock:
                    return {child_lock: value ? 'LOCK' : 'UNLOCK'};
    
            case tuyaDeviceCode.dataPoints.sh4Battery:
                //97x = 2.673v
                //98x = 2.679v
                //125 = 2.955v
                //135x = 3.052v
                //157x = 3.268v
                //return {battery_Value: (value), voltage: (value / 0.05).toFixed(1), battery: ((value / 0.05) - 2100) / 10}; //incorect
                return {
                    battery_Value: (value),
                    battery: value > 130 ? 100 : value < 70 ? 0 : ((value - 70)*1.7).toFixed(1),
                    battery_low: value < 90
                };
            case tuyaDeviceCode.dataPoints.sh4FaultCode: //FaultCode
                meta.logger.info(`Error: ${value}`);
                break;  
            case tuyaDeviceCode.dataPoints.sh4ComfortTemp: //comfort temperature
                return {heat_temperature: (value / 2).toFixed(1)};

            case tuyaDeviceCode.dataPoints.sh4EcoTemp: //away temperature
                return {away_temperature: (value / 2).toFixed(1)};

            case tuyaDeviceCode.dataPoints.sh4VacationPeriod: // need test
            return {
                away_data: {
                    year: value[0]+2000,
                    month: value[1],
                    day: value[2],
                    hour: value[3],
                    minute: value[4],
                    temperature: (value[5] /2).toFixed(1),
                    away_hours: value[6]<< 8 | value[7],
                    },
                };
            case tuyaDeviceCode.dataPoints.sh4TempCalibration: //"data":[255,255,255,251] 
                return {local_temperature_calibration: value > 55 ?
                ((value - 0x100000000)/10).toFixed(1) 
                : (value/ 10).toFixed(1)};
            case tuyaDeviceCode.dataPoints.sh4ScheduleTempOverride:
                var temp = (value / 2).toFixed(1);
                return {current_heating_setpoint: temp, current_heating_setpoint_auto: temp};

            case tuyaDeviceCode.dataPoints.sh4RapidHeating: //close 118 countdown
                return {timer: value};

            case tuyaDeviceCode.dataPoints.sh4RapidHeatCntdownTimer:
                return {timer_cntdown: value};
            
            case tuyaDeviceCode.dataPoints.sh4WindowStatus: // value [0] Window Status
                return {window_status: value[0 == 1 ? 'open' : 'close']}
            case tuyaDeviceCode.dataPoints.sh4OpenWindowTemp:
                return {open_window_temperature: value / 2};
    
            case tuyaDeviceCode.dataPoints.sh4OpenWindowTime:
                return {open_window_time: value};
    
            case tuyaDeviceCode.dataPoints.sh4RapidHeatCntdownTimer:
                return {boost_time: value};

            // case id: - day of week
            case tuyaDeviceCode.dataPoints.sh4ScheduleMon: // "data":[1,34,24,42,36,34,68,42,92,34,96,42,96,34,96,42,96,34]
            case tuyaDeviceCode.dataPoints.sh4ScheduleTue: // data":[2,34,24,42,36,34,68,42,92,34,96,42,96,34,96,42,96,34]
            case tuyaDeviceCode.dataPoints.sh4ScheduleWed: //data":[3,34,24,42,36,34,68,42,92,34,96,42,96,34,96,42,96,34]
            case tuyaDeviceCode.dataPoints.sh4ScheduleThu: //"data":[4,34,24,42,36,34,68,42,92,34,96,42,96,34,96,42,96,34]
            case tuyaDeviceCode.dataPoints.sh4ScheduleFri: //"data":[5,34,24,42,36,34,68,42,92,34,96,42,96,34,96,42,96,34]
            case tuyaDeviceCode.dataPoints.sh4ScheduleSat: // week "data":[6,34,24,42,36,34,68,42,92,34,96,42,96,34,96,42,96,34]
            case tuyaDeviceCode.dataPoints.sh4ScheduleSun: // sun "data":[7,34,24,42,36,34,68,42,92,34,96,42,96,34,96,42,96,34]
                function GetTimeFormValue(value) {
                    var totalMin = value * 15;
                    var min = totalMin % 60;
                    var hours = (totalMin - min)/60;
                    return `${hours}h:${min}m`;
                }    
                const days = {0: '???', 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday', 6: 'Saturday', 7: 'Sunday'};
                    return JSON.parse(`{ "program_auto_${days[value[0]]}": {
                        "program": [{
                            "0h:0m" : "${value[1] / 2} °C",
                            "${GetTimeFormValue(value[2])}": "${value[3] / 2} °C",
                            "${GetTimeFormValue(value[4])}": "${value[5] / 2} °C",
                            "${GetTimeFormValue(value[6])}": "${value[7] / 2} °C",
                            "${GetTimeFormValue(value[8])}": "${value[9] / 2} °C",
                            "${GetTimeFormValue(value[10])}" : "${value[11] / 2} °C"
                        }]
                    }}`);

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
            await tuya.sendDataPointRaw(entity, tuyaDeviceCode.dataPoints.sh4ChildLock, [lock]);
        },
    },
    awow_thermostat_current_heating_setpoint_auto: {
        key: ['current_heating_setpoint_auto'],
        convertSet: async (entity, key, value, meta) => {
            const temp = parseInt(value * 2);
            await tuya.sendDataPointRaw(entity, tuyaDeviceCode.dataPoints.sh4ScheduleTempOverride, [0, 0 ,0, temp]);
        },
    },
    awow_thermostat_current_heating_setpoint: {
        key: ['current_heating_setpoint'],
        // set manual mode
        convertSet: async (entity, key, value, meta) => {
            const temp = parseInt(value * 2);
            await tuya.sendDataPointRaw(entity, tuyaDeviceCode.dataPoints.sh4HeatingSetpoint, [0, 0 ,0, temp]);
            await tuya.sendDataPointRaw(entity, tuyaDeviceCode.dataPoints.sh4Mode, [1]);
        },
    },
    awow_thermostat_current_mode: {
        key: ['system_mode'],
        convertSet: async (entity, key, value, meta) => {

            switch (value) {
            case 'auto':
                await tuya.sendDataPointRaw(entity, tuyaDeviceCode.dataPoints.sh4Mode, [0]);
                break;
            case 'heat':
                await tuya.sendDataPointRaw(entity, tuyaDeviceCode.dataPoints.sh4HeatingSetpoint, [0, 0 ,0, 60]);
                await tuya.sendDataPointRaw(entity, tuyaDeviceCode.dataPoints.sh4Mode, [1]);
                //await tuya.sendDataPointRaw(entity, 2, [1]);
                break;
            case 'off':
                await tuya.sendDataPointRaw(entity,tuyaDeviceCode.dataPoints.sh4HeatingSetpoint, [0, 0 ,0, 0]);
                await tuya.sendDataPointRaw(entity, tuyaDeviceCode.dataPoints.sh4Mode, [1]);
                //await tuya.sendDataPointRaw(entity, 2, [2]);//holiday mode
                break;
            default:
                meta.logger.info(`awow_thermostat_current_mode  value #${value}`);
            }

        },
        convertGet: async (entity, key, value, meta) => {
            await tuya.sendDataPointEnum(entity,tuyaDeviceCode.dataPoints.sh4RequestUpdate, 0);
        },
    },
    awow_thermostat_open_window_temperature: {
        key: ['open_window_temperature'],
        convertSet: async (entity, key, value, meta) => {
            const temp = parseInt(value * 2);
            await tuya.sendDataPointRaw(entity, tuyaDeviceCode.dataPoints.sh4OpenWindowTemp, [0, 0 ,0, temp]);
        },
    },
    awow_thermostat_heat_temperature: {
        key: ['heat_temperature'],
        convertSet: async (entity, key, value, meta) => {
            const temp = parseInt(value * 2);
            await tuya.sendDataPointRaw(entity, tuyaDeviceCode.dataPoints.sh4ComfortTemp, [0, 0 ,0, temp]);
        },
    },
    awow_thermostat_away_temperature: {
        key: ['away_temperature'],
        convertSet: async (entity, key, value, meta) => {
            const temp = parseInt(value * 2);
            await tuya.sendDataPointRaw(entity, tuyaDeviceCode.dataPoints.sh4EcoTemp, [0, 0 ,0, temp]);
        },
    },
    awow_thermostat_thermostat_mode: {
        key: ['thermostat_mode'],
        convertSet: async (entity, key, value, meta) => {
            var mode_key = Object.keys(thermostat_modes)[Object.values(thermostat_modes).indexOf(value)];
            await tuya.sendDataPointRaw(entity, 2, [mode_key]);
        },
        convertGet: async (entity, key, value, meta) => {
            await tuya.sendDataPointEnum(entity, tuyaDeviceCode.dataPoints.sh4RequestUpdate, 0);
        },
    },
    awow_thermostat_calibration: {
        key: ['local_temperature_calibration'],
        convertSet: async (entity, key, value, meta) => {
            if (value > 0) 
            value = value*10;
        else if (value < 0) 
            value = value*10 + 0x100000000;
        await tuya.sendDataPointValue(entity, tuyaDeviceCode.dataPoints.sh4TempCalibration, value);
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
        tz2.awow_thermostat_heat_temperature,
        tz2.awow_thermostat_away_temperature,
        tz2.awow_thermostat_thermostat_mode,
        tz2.awow_thermostat_calibration
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
        e.battery_low(),
        e.child_lock(),
        e.open_window_temperature().withValueMin(5).withValueMax(30),
        exposes.numeric('heat_temperature', ea.STATE_SET).withValueMin(0.5).withValueMax(29.5).withValueStep(0.5)
                .withUnit('C').withDescription('Heat temperature'),
        exposes.numeric('away_temperature', ea.STATE_SET).withValueMin(0.5).withValueMax(29.5).withValueStep(0.5)
                .withUnit('C').withDescription('Away temperature'),
        exposes.enum('thermostat_mode', ea.ALL, ['auto', 'manual', 'away']),
        exposes.numeric('local_temperature_calibration', ea.STATE_SET).withValueMin(-5).withValueMax(5).withValueStep(0.1)
        .withUnit('C').withDescription('Temperature calibration'),
        exposes.numeric('timer_cntdown', ea.STATE_SET).withUnit('s').withDescription('Heat timer countdown'),
    ],
};

module.exports = definition;