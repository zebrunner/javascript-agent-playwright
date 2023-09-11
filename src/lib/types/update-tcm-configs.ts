import { ReportingConfig } from '../reporting-config';

export class UpdateTcmConfigsRequest {

    private _hasAnyValue = false;

    zebrunnerSyncEnabled: boolean;
    zebrunnerSyncRealTime: boolean;
    zebrunnerTestRunId: number;

    testRailSyncEnabled: boolean;
    testRailSyncRealTime: boolean;
    testRailSuiteId: number;
    testRailRunId: number;
    testRailIncludeAllCases: boolean;
    testRailRunName: string;
    testRailAssignee: string;
    testRailMilestoneName: string;

    xraySyncEnabled: boolean;
    xraySyncRealTime: boolean;
    xrayTestExecutionKey: string;

    zephyrSyncEnabled: boolean;
    zephyrSyncRealTime: boolean;
    zephyrTestCycleKey: string;
    zephyrJiraProjectKey: string;

    constructor(reportingConfig: ReportingConfig) {
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

    private trackHasAnyValue<T extends string | number | boolean>(value: T): T {
        if (value) {
            this._hasAnyValue = true;
        }
        return value;
    }

    get hasAnyValue(): boolean {
        return this._hasAnyValue;
    }

}
