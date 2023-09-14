export function isString(value: any) {
    return typeof value === 'string' || value instanceof String;
}

export function isNotBlankString(value: any) {
    return isString(value) && value.trim().length;
}

export function isBuffer(value: any) {
    return Buffer.isBuffer(value);
}

export function isFunction(value: any) {
    return typeof value === 'function';
}

export function isPromise(value: any) {
    return typeof value === 'object' && typeof value.then === 'function';
}

export function isArray(value: any) {
    return Array.isArray(value);
}

export function isNotEmptyArray(value: any) {
    return isArray(value) && value.length;
}
