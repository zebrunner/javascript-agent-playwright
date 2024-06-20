"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNumber = exports.getBoolean = exports.getString = void 0;
const helpers_1 = require("../helpers");
function getString(envVar, configValue, defaultValue = null) {
    const envValue = process.env[envVar];
    return (0, helpers_1.isNotBlankString)(envValue) ? envValue : (0, helpers_1.isNotBlankString)(configValue) ? configValue : defaultValue;
}
exports.getString = getString;
function getBoolean(envVar, configValue, defaultValue = false) {
    if (process.env[envVar]?.toLowerCase?.() === 'false') {
        return false;
    }
    if (process.env[envVar]?.toLowerCase?.() === 'true') {
        return true;
    }
    if (configValue === false || configValue?.toLowerCase?.() === 'false') {
        return false;
    }
    if (configValue === true || configValue?.toLowerCase?.() === 'true') {
        return true;
    }
    return defaultValue;
}
exports.getBoolean = getBoolean;
function getNumber(envVar, configValue, defaultValue = null) {
    return parseInt(process.env[envVar], 10) || parseInt(configValue, 10) || defaultValue;
}
exports.getNumber = getNumber;
//# sourceMappingURL=helpers.js.map