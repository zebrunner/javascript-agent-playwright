"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateTcmConfigsRequest = void 0;
class UpdateTcmConfigsRequest {
    _hasAnyValue = false;
    zebrunnerSyncEnabled;
    zebrunnerSyncRealTime;
    zebrunnerTestRunId;
    testRailSyncEnabled;
    testRailSyncRealTime;
    testRailSuiteId;
    testRailRunId;
    testRailIncludeAllCases;
    testRailRunName;
    testRailAssignee;
    testRailMilestoneName;
    xraySyncEnabled;
    xraySyncRealTime;
    xrayTestExecutionKey;
    zephyrSyncEnabled;
    zephyrSyncRealTime;
    zephyrTestCycleKey;
    zephyrJiraProjectKey;
    constructor(reportingConfig) {
        this.zebrunnerSyncEnabled = this.trackHasAnyValue(reportingConfig?.tcm?.zebrunner?.pushResults);
        this.zebrunnerSyncRealTime = this.trackHasAnyValue(reportingConfig?.tcm?.zebrunner?.pushInRealTime);
        this.zebrunnerTestRunId = this.trackHasAnyValue(reportingConfig?.tcm?.zebrunner?.testRunId);
        this.testRailSyncEnabled = this.trackHasAnyValue(reportingConfig?.tcm?.testRail?.pushResults);
        this.testRailSyncRealTime = this.trackHasAnyValue(reportingConfig?.tcm?.testRail?.pushInRealTime);
        this.testRailSuiteId = this.trackHasAnyValue(reportingConfig?.tcm?.testRail?.suiteId);
        this.testRailRunId = this.trackHasAnyValue(reportingConfig?.tcm?.testRail?.runId);
        this.testRailIncludeAllCases = this.trackHasAnyValue(reportingConfig?.tcm?.testRail?.includeAllTestCasesInNewRun);
        this.testRailRunName = this.trackHasAnyValue(reportingConfig?.tcm?.testRail?.runName);
        this.testRailAssignee = this.trackHasAnyValue(reportingConfig?.tcm?.testRail?.assignee);
        this.testRailMilestoneName = this.trackHasAnyValue(reportingConfig?.tcm?.testRail?.milestoneName);
        this.xraySyncEnabled = this.trackHasAnyValue(reportingConfig?.tcm?.xray?.pushResults);
        this.xraySyncRealTime = this.trackHasAnyValue(reportingConfig?.tcm?.xray?.pushInRealTime);
        this.xrayTestExecutionKey = this.trackHasAnyValue(reportingConfig?.tcm?.xray?.executionKey);
        this.zephyrSyncEnabled = this.trackHasAnyValue(reportingConfig?.tcm?.zephyr?.pushResults);
        this.zephyrSyncRealTime = this.trackHasAnyValue(reportingConfig?.tcm?.zephyr?.pushInRealTime);
        this.zephyrTestCycleKey = this.trackHasAnyValue(reportingConfig?.tcm?.zephyr?.testCycleKey);
        this.zephyrJiraProjectKey = this.trackHasAnyValue(reportingConfig?.tcm?.zephyr?.jiraProjectKey);
    }
    trackHasAnyValue(value) {
        if (value) {
            this._hasAnyValue = true;
        }
        return value;
    }
    get hasAnyValue() {
        return this._hasAnyValue;
    }
}
exports.UpdateTcmConfigsRequest = UpdateTcmConfigsRequest;
//# sourceMappingURL=UpdateTcmConfigsRequest.js.map