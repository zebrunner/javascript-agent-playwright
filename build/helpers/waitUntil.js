"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.waitUntil = void 0;
const waitUntil = (predFn) => {
    const poll = (resolve) => (predFn() ? resolve() : setTimeout(() => poll(resolve), 500));
    return new Promise(poll);
};
exports.waitUntil = waitUntil;
//# sourceMappingURL=waitUntil.js.map