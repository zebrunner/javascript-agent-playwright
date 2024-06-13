"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPwStepObject = void 0;
const createPwStepObject = (timestamp, title, level = 'INFO') => {
    return {
        startTime: new Date(timestamp),
        title,
        duration: new Date().getTime() - timestamp,
        category: `zebrunner:log:${level}`,
        steps: [],
        titlePath: () => [`zebrunner:log:${level}`],
    };
};
exports.createPwStepObject = createPwStepObject;
//# sourceMappingURL=createPwStepObject.js.map