"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFinishedTestCount = void 0;
const getFinishedTestCount = (pwTestIdToZbrFinishedTry) => {
    return Array.from(pwTestIdToZbrFinishedTry.values()).reduce((acc, value) => acc + value + 1, 0);
};
exports.getFinishedTestCount = getFinishedTestCount;
//# sourceMappingURL=getFinishedTestCount.js.map