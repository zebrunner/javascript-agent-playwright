export class ExchangedLaunchContext {
  launchUuid: string;
  mode: 'NEW' | 'RERUN';
  runAllowed: boolean;
  reason: string;
  runOnlySpecificTests: boolean;
  testsToRun: {
    id: number;
    correlationData: string;
  }[];
  fullExecutionPlanContext: string;

  constructor(response: any) {
    this.launchUuid = response.launchUuid;
    this.mode = response.mode;

    this.runAllowed = response.runAllowed;
    this.reason = response.reason;

    this.runOnlySpecificTests = response.runOnlySpecificTests;
    this.testsToRun = response.testsToRun;

    this.fullExecutionPlanContext = response.fullExecutionPlanContext;
  }
}
