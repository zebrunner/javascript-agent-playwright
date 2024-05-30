"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanseReason = void 0;
const cleanseReason = (rawReason) => {
    return rawReason
        ? rawReason
            .replace(/\u001b\[2m/g, '')
            .replace(/\u001b\[22m/g, '')
            .replace(/\u001b\[31m/g, '')
            .replace(/\u001b\[39m/g, '')
            .replace(/\u001b\[32m/g, '')
            .replace(/\u001b\[27m/g, '')
            .replace(/\u001b\[7m/g, '')
        : '';
};
exports.cleanseReason = cleanseReason;
//# sourceMappingURL=cleanseReason.js.map