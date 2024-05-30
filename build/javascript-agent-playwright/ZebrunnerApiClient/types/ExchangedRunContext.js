"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExchangedRunContext = void 0;
class ExchangedRunContext {
    testRunUuid;
    mode;
    runAllowed;
    reason;
    runOnlySpecificTests;
    testsToRun;
    fullExecutionPlanContext;
    constructor(response) {
        this.testRunUuid = response.testRunUuid;
        this.mode = response.mode;
        this.runAllowed = response.runAllowed;
        this.reason = response.reason;
        this.runOnlySpecificTests = response.runOnlySpecificTests;
        this.testsToRun = response.testsToRun;
        this.fullExecutionPlanContext = response.fullExecutionPlanContext;
    }
}
exports.ExchangedRunContext = ExchangedRunContext;
//# sourceMappingURL=ExchangedRunContext.js.map