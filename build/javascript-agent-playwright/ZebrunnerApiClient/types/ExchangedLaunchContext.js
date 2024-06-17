"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExchangedLaunchContext = void 0;
class ExchangedLaunchContext {
    launchUuid;
    mode;
    runAllowed;
    reason;
    runOnlySpecificTests;
    testsToRun;
    fullExecutionPlanContext;
    constructor(response) {
        this.launchUuid = response.testRunUuid;
        this.mode = response.mode;
        this.runAllowed = response.runAllowed;
        this.reason = response.reason;
        this.runOnlySpecificTests = response.runOnlySpecificTests;
        this.testsToRun = response.testsToRun;
        this.fullExecutionPlanContext = response.fullExecutionPlanContext;
    }
}
exports.ExchangedLaunchContext = ExchangedLaunchContext;
//# sourceMappingURL=ExchangedLaunchContext.js.map