"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.until = void 0;
const until = (predFn) => {
    const poll = (resolve) => (predFn() ? resolve() : setTimeout(() => poll(resolve), 500));
    return new Promise(poll);
};
exports.until = until;
//# sourceMappingURL=until.js.map