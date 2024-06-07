import { isNotBlankString } from '../helpers';

interface ServerConfig {
  readonly hostname: string;
  readonly accessToken: string;
}

interface LaunchConfig {
  readonly displayName: string;
  readonly build: string;
  readonly environment: string;
  readonly treatSkipsAsFailures: boolean;
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

function getString(envVar: string, configValue: any, defaultValue: string = null): string {
  const value = process.env[envVar] as string;

  return isNotBlankString(value) ? value : isNotBlankString(configValue) ? configValue : defaultValue;
}

function getBoolean(envVar: string, configValue: any, defaultValue = false): boolean {
  if (process.env[envVar]?.toLowerCase?.() === 'false') {
    return false;
  }

  return (
    process.env[envVar]?.toLowerCase?.() === 'true' ||
    configValue === true ||
    configValue?.toLowerCase?.() === 'true' ||
    defaultValue
  );
}

function getNumber(envVar: string, configValue: any, defaultValue: number = null): number {
  return parseInt(process.env[envVar], 10) || parseInt(configValue, 10) || defaultValue;
}

export class ReportingConfig {
  readonly enabled: boolean;

  readonly projectKey: string;

  readonly server: ServerConfig;

  readonly launch: LaunchConfig;

  readonly milestone: MilestoneConfig;

  readonly notifications: NotificationsConfig;

  readonly tcm: Tcm;

  constructor(config: any) {
    this.enabled = getBoolean('REPORTING_ENABLED', config?.enabled);
    this.projectKey = getString('REPORTING_PROJECT_KEY', config?.projectKey, 'DEF');
    this.server = {
      hostname: getString('REPORTING_SERVER_HOSTNAME', config?.server?.hostname),
      accessToken: getString('REPORTING_SERVER_ACCESS_TOKEN', config?.server?.accessToken),
    };

    if (this.enabled === true && !this.server.hostname && !this.server.accessToken) {
      throw new Error('When reporting is enabled, you must provide Zebrunner hostname and accessToken');
    }

    this.launch = {
      displayName: getString(
        'REPORTING_LAUNCH_DISPLAY_NAME',
        config?.launch?.displayName,
        isNotBlankString(process.env.npm_package_name) ? process.env.npm_package_name : 'Default Suite',
      ),
      build: getString('REPORTING_LAUNCH_BUILD', config?.launch?.build),
      environment: getString('REPORTING_LAUNCH_ENVIRONMENT', config?.launch?.environment),
      treatSkipsAsFailures: getBoolean('REPORTING_LAUNCH_TREAT_SKIPS_AS_FAILURES', config?.launch?.treatSkipsAsFailures, true)
    };

    this.milestone = {
      idFromConfig: config?.milestone?.id,
      idFromEnv: getNumber('REPORTING_MILESTONE_ID', null),
      nameFromConfig: config?.milestone?.name,
      nameFromEnv: getString('REPORTING_MILESTONE_NAME', null),
    };

    this.notifications = {
      notifyOnEachFailure: getBoolean(
        'REPORTING_NOTIFICATION_NOTIFY_ON_EACH_FAILURE',
        config?.notifications?.notifyOnEachFailure,
      ),
      slackChannels: getString('REPORTING_NOTIFICATION_SLACK_CHANNELS', config?.notifications?.slackChannels),
      teamsChannels: getString('REPORTING_NOTIFICATION_MS_TEAMS_CHANNELS', config?.notifications?.teamsChannels),
      emails: getString('REPORTING_NOTIFICATION_EMAILS', config?.notifications?.emails),
    };

    this.tcm = {
      testCaseStatus: {
        onPass: getString('REPORTING_TCM_TEST_CASE_STATUS_ON_PASS', config?.tcm?.testCaseStatus?.onPass),
        onFail: getString('REPORTING_TCM_TEST_CASE_STATUS_ON_FAIL', config?.tcm?.testCaseStatus?.onFail),
      },
      zebrunner: {
        pushResults: getBoolean('REPORTING_TCM_ZEBRUNNER_PUSH_RESULTS', config?.tcm?.zebrunner?.pushResults),
        pushInRealTime: getBoolean('REPORTING_TCM_ZEBRUNNER_PUSH_IN_REAL_TIME', config?.tcm?.zebrunner?.pushInRealTime),
        testRunId: getNumber('REPORTING_TCM_ZEBRUNNER_TEST_RUN_ID', config?.tcm?.zebrunner?.testRunId),
      },
      testRail: {
        pushResults: getBoolean('REPORTING_TCM_TESTRAIL_PUSH_RESULTS', config?.tcm?.testRail?.pushResults),
        pushInRealTime: getBoolean('REPORTING_TCM_TESTRAIL_PUSH_IN_REAL_TIME', config?.tcm?.testRail?.pushInRealTime),
        suiteId: getNumber('REPORTING_TCM_TESTRAIL_SUITE_ID', config?.tcm?.testRail?.suiteId),
        runId: getNumber('REPORTING_TCM_TESTRAIL_RUN_ID', config?.tcm?.testRail?.runId),
        includeAllTestCasesInNewRun: getBoolean(
          'REPORTING_TCM_TESTRAIL_INCLUDE_ALL_IN_NEW_RUN',
          config?.tcm?.testRail?.includeAllTestCasesInNewRun,
        ),
        runName: getString('REPORTING_TCM_TESTRAIL_RUN_NAME', config?.tcm?.testRail?.runName),
        milestoneName: getString('REPORTING_TCM_TESTRAIL_MILESTONE_NAME', config?.tcm?.testRail?.milestoneName),
        assignee: getString('REPORTING_TCM_TESTRAIL_ASSIGNEE', config?.tcm?.testRail?.assignee),
      },
      xray: {
        pushResults: getBoolean('REPORTING_TCM_XRAY_PUSH_RESULTS', config?.tcm?.xray?.pushResults),
        pushInRealTime: getBoolean('REPORTING_TCM_XRAY_PUSH_IN_REAL_TIME', config?.tcm?.xray?.pushInRealTime),
        executionKey: getString('REPORTING_TCM_XRAY_EXECUTION_KEY', config?.tcm?.xray?.executionKey),
      },
      zephyr: {
        pushResults: getBoolean('REPORTING_TCM_ZEPHYR_PUSH_RESULTS', config?.tcm?.zephyr?.pushResults),
        pushInRealTime: getBoolean('REPORTING_TCM_ZEPHYR_PUSH_IN_REAL_TIME', config?.tcm?.zephyr?.pushInRealTime),
        jiraProjectKey: getString('REPORTING_TCM_ZEPHYR_JIRA_PROJECT_KEY', config?.tcm?.zephyr?.jiraProjectKey),
        testCycleKey: getString('REPORTING_TCM_ZEPHYR_TEST_CYCLE_KEY', config?.tcm?.zephyr?.testCycleKey),
      },
    };
  }
}
