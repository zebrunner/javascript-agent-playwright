"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCustomScreenshotObject = void 0;
const getCustomScreenshotObject = (payload) => {
    return {
        timestamp: payload.timestamp,
        pathOrBuffer: payload.pathOrBuffer.type === 'Buffer' ? Buffer.from(payload.pathOrBuffer) : payload.pathOrBuffer,
    };
};
exports.getCustomScreenshotObject = getCustomScreenshotObject;
//# sourceMappingURL=getCustomScreenshotObject.js.map