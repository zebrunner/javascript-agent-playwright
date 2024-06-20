"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPwStepObject = void 0;
const createPwStepObject = (timestamp, title, action, screenshotPathOrBuffer) => {
    return {
        startTime: new Date(timestamp),
        title,
        duration: new Date().getTime() - timestamp,
        category: `zebrunner:${action}`,
        steps: [],
        titlePath: () => [`zebrunner:${action}`],
        screenshotPathOrBuffer,
    };
};
exports.createPwStepObject = createPwStepObject;
//# sourceMappingURL=createPwStepObject.js.map