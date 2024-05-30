"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTestSteps = void 0;
const cleanseReason_1 = require("./cleanseReason");
const getTestSteps = (steps, zbrTestId) => {
    const testSteps = [];
    for (const testStep of steps) {
        testSteps.push({
            timestamp: new Date(testStep.startTime).getTime(),
            message: testStep.error
                ? `${(0, cleanseReason_1.cleanseReason)(testStep.error?.message)} \n ${(0, cleanseReason_1.cleanseReason)(testStep.error?.stack)}`
                : testStep.title,
            level: testStep.error ? 'ERROR' : 'INFO',
            testId: zbrTestId,
        });
    }
    return testSteps;
};
exports.getTestSteps = getTestSteps;
//# sourceMappingURL=getTestSteps.js.map