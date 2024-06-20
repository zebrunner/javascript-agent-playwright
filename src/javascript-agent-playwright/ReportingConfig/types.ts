interface ServerConfig {
  readonly hostname: string;
  readonly accessToken: string;
}

interface LaunchConfig {
  readonly displayName: string;
  readonly build: string;
  readonly environment: string;
  readonly locale: string;
  readonly treatSkipsAsFailures: boolean;
}

interface LogsConfig {
  readonly ignorePlaywrightSteps: boolean;
  readonly useLinesFromSourceCode: boolean;
  readonly ignoreConsole: boolean;
  readonly ignoreCustom: boolean;
  readonly ignoreManualScreenshots: boolean;
  readonly ignoreAutoScreenshots: boolean;
}

interface MilestoneConfig {
  readonly idFromConfig: number;
  readonly idFromEnv: number;
  readonly nameFromConfig: string;
  readonly nameFromEnv: string;
}

interface NotificationsConfig {
  readonly notifyOnEachFailure: boolean;

  readonly slackChannels: string;
  readonly teamsChannels: string;
  readonly emails: string;
}

interface Tcm {
  readonly testCaseStatus: TestCaseStatus;

  readonly zebrunner: ZebrunnerTcm;
  readonly testRail: TestRailTcm;
  readonly xray: XrayTcm;
  readonly zephyr: ZephyrTcm;
}

interface TestCaseStatus {
  readonly onPass: string;
  readonly onFail: string;
  readonly onSkip: string;
}

interface ZebrunnerTcm {
  readonly pushResults: boolean;
  readonly pushInRealTime: boolean;

  readonly testRunId: number;
}

interface TestRailTcm {
  readonly pushResults: boolean;
  readonly pushInRealTime: boolean;

  readonly suiteId: number;
  readonly runId: number;

  readonly includeAllTestCasesInNewRun: boolean;
  readonly runName: string;
  readonly milestoneName: string;
  readonly assignee: string;
}

interface XrayTcm {
  readonly pushResults: boolean;
  readonly pushInRealTime: boolean;

  readonly executionKey: string;
}

interface ZephyrTcm {
  readonly pushResults: boolean;
  readonly pushInRealTime: boolean;

  readonly jiraProjectKey: string;
  readonly testCycleKey: string;
}
