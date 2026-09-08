export class ExchangedLaunchContext {
  launchUuid: string;
  mode: 'NEW' | 'RERUN';
  runAllowed: boolean;
  reason: string;
  runOnlySpecificTests: boolean;
  testsToRun: {
    id: number;
    name: string;
    correlationData: string;
    status: string;
    startedAt: string;
    endedAt: string;
  }[];
  fullExecutionPlanContext: string;

  constructor(response: any) {
    this.launchUuid = response.testRunUuid;
    this.mode = response.mode;

    this.runAllowed = response.runAllowed;
    this.reason = response.reason;

    this.runOnlySpecificTests = response.runOnlySpecificTests;
    this.testsToRun = response.testsToRun;

    this.fullExecutionPlanContext = response.fullExecutionPlanContext;
  }
}
