"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.determineStatus = void 0;
const determineStatus = (status) => {
    if (status === 'failed')
        return 'FAILED';
    if (status === 'passed')
        return 'PASSED';
    if (status === 'skipped')
        return 'SKIPPED';
    return 'ABORTED';
};
exports.determineStatus = determineStatus;
//# sourceMappingURL=determineStatus.js.map