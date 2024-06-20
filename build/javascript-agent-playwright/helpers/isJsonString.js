"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isJsonString = void 0;
const isJsonString = (str) => {
    try {
        JSON.parse(str);
    }
    catch (e) {
        return false;
    }
    return true;
};
exports.isJsonString = isJsonString;
//# sourceMappingURL=isJsonString.js.map