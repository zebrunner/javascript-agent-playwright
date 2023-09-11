type RunMode = 'NEW' | 'RERUN'

export interface Test {

    readonly id: number;
    readonly correlationData: string;

}

export class ExchangedRunContext {

    testRunUuid: string;
    mode: RunMode;
    runAllowed: boolean;
    reason: string;
    runOnlySpecificTests: boolean;
    testsToRun: Test[];
    fullExecutionPlanContext: string;

    constructor(response: any) {
        this.testRunUuid = response.testRunUuid;
        this.mode = response.mode;

        this.runAllowed = response.runAllowed;
        this.reason = response.reason;

        this.runOnlySpecificTests = response.runOnlySpecificTests;
        this.testsToRun = response.testsToRun;

        this.fullExecutionPlanContext = response.fullExecutionPlanContext;
    }

}
