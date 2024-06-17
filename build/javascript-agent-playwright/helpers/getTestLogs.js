"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTestLogs = void 0;
const cleanseReason_1 = require("./cleanseReason");
const fs = __importStar(require("fs"));
const getTestLogs = (steps, zbrTestId, ignorePlaywrightSteps, useLinesFromSourceCode) => {
    const testSteps = [];
    console.log(ignorePlaywrightSteps, useLinesFromSourceCode);
    for (const testStep of steps) {
        if (!(ignorePlaywrightSteps && !testStep.category.includes('zebrunner'))) {
            if (testStep.category === 'zebrunner:screenshot') {
                testSteps.push({
                    timestamp: new Date(testStep.startTime).getTime(),
                    testId: zbrTestId,
                    type: 'screenshot',
                    screenshotPathOrBuffer: testStep.screenshotPathOrBuffer,
                });
            }
            else {
                const lineFromSource = useLinesFromSourceCode && testStep.location?.file && testStep.location?.line
                    ? fs.readFileSync(testStep.location.file, 'utf-8').split(/\r?\n/)[testStep.location?.line - 1].trim()
                    : null;
                testSteps.push({
                    timestamp: new Date(testStep.startTime).getTime(),
                    message: testStep.error
                        ? `${lineFromSource ? `${lineFromSource}\n\n` : ''}${(0, cleanseReason_1.cleanseReason)(testStep.error?.message)} \n ${(0, cleanseReason_1.cleanseReason)(testStep.error?.stack)}`
                        : lineFromSource
                            ? lineFromSource
                            : testStep.title,
                    level: testStep.category.includes('zebrunner:log:')
                        ? testStep.category.split(':')[2]
                        : testStep.error
                            ? 'ERROR'
                            : 'INFO',
                    testId: zbrTestId,
                    type: 'log',
                });
            }
        }
    }
    return testSteps;
};
exports.getTestLogs = getTestLogs;
//# sourceMappingURL=getTestLogs.js.map