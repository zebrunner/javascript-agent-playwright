"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isNotEmptyArray = exports.isArray = exports.isPromise = exports.isFunction = exports.isBuffer = exports.isNotBlankString = exports.isString = void 0;
function isString(value) {
    return typeof value === 'string' || value instanceof String;
}
exports.isString = isString;
function isNotBlankString(value) {
    return isString(value) && value.trim().length;
}
exports.isNotBlankString = isNotBlankString;
function isBuffer(value) {
    return Buffer.isBuffer(value);
}
exports.isBuffer = isBuffer;
function isFunction(value) {
    return typeof value === 'function';
}
exports.isFunction = isFunction;
function isPromise(value) {
    return typeof value === 'object' && typeof value.then === 'function';
}
exports.isPromise = isPromise;
function isArray(value) {
    return Array.isArray(value);
}
exports.isArray = isArray;
function isNotEmptyArray(value) {
    return isArray(value) && value.length;
}
exports.isNotEmptyArray = isNotEmptyArray;
//# sourceMappingURL=type-utils.js.map