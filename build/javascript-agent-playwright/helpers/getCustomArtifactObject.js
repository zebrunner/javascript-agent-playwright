"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCustomArtifactObject = void 0;
const getCustomArtifactObject = (payload) => {
    return {
        timestamp: payload.timestamp,
        pathOrBuffer: payload.pathOrBuffer.type === 'Buffer' ? Buffer.from(payload.pathOrBuffer) : payload.pathOrBuffer,
        name: payload.name,
    };
};
exports.getCustomArtifactObject = getCustomArtifactObject;
//# sourceMappingURL=getCustomArtifactObject.js.map