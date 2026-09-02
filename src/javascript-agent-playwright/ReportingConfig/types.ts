// Public reporter option types (what users write in playwright.config) and the resolved shapes the agent uses.

/**
 * On/off option. Prefer a boolean; `'true'` / `'false'` are accepted so an
 * environment variable can be passed through unparsed.
 */
export type ZebrunnerFlag = boolean | 'true' | 'false';

/** Numeric option. Strings are parsed with `parseInt`, so an environment variable can be passed through unparsed. */
export type ZebrunnerNumeric = number | string;

/**
 * How a Playwright step is rendered as a Zebrunner log message.
 *
 * - `structured` - action name with its arguments, e.g. `click(#submit)`.
 * - `playwright-title` - the step title as Playwright reports it.
 * - `source-line` - the line(s) of test source code the step originates from.
 */
export type ZebrunnerLogFormat = 'structured' | 'playwright-title' | 'source-line';

/** Zebrunner instance the results are reported to. Required when `enabled` is `true`. */
export interface ZebrunnerServerOptions {
  /** Zebrunner hostname, e.g. `https://mycompany.zebrunner.com`. Env: `REPORTING_SERVER_HOSTNAME`. */
  hostname?: string;
  /** Access token from the Zebrunner user profile page. Env: `REPORTING_SERVER_ACCESS_TOKEN`. */
  accessToken?: string;
}

export interface ZebrunnerLaunchOptions {
  /**
   * Launch name shown in Zebrunner. Defaults to the `name` from `package.json`.
   * Env: `REPORTING_LAUNCH_DISPLAY_NAME`.
   */
  displayName?: string;
  /** Build number or version under test. Env: `REPORTING_LAUNCH_BUILD`. */
  build?: string;
  /** Environment under test, e.g. `staging`. Env: `REPORTING_LAUNCH_ENVIRONMENT`. */
  environment?: string;
  /** Locale reported as a launch label, e.g. `en_US`. Env: `REPORTING_LAUNCH_LOCALE`. */
  locale?: string;
  /** Report skipped tests as failures. Defaults to `true`. Env: `REPORTING_LAUNCH_TREAT_SKIPS_AS_FAILURES`. */
  treatSkipsAsFailures?: ZebrunnerFlag;
}

export interface ZebrunnerLogsOptions {
  /** Do not attach Playwright steps as logs. Defaults to `false`. Env: `REPORTING_LOGS_IGNORE_PLAYWRIGHT_STEPS`. */
  ignorePlaywrightSteps?: ZebrunnerFlag;
  /** Attach `before`/`after` hook steps. Defaults to `false`. Env: `REPORTING_LOGS_INCLUDE_HOOKS`. */
  includeHooks?: ZebrunnerFlag;
  /** Attach fixture setup/teardown steps. Defaults to `false`. Env: `REPORTING_LOGS_INCLUDE_FIXTURES`. */
  includeFixtures?: ZebrunnerFlag;
  /** Attach `page.bridge.*` actions. Defaults to `false`. Env: `REPORTING_LOGS_INCLUDE_BRIDGE_ACTIONS`. */
  includeBridgeActions?: ZebrunnerFlag;
  /**
   * @deprecated Use `format` instead: `true` maps to `'source-line'`, `false` to `'playwright-title'`.
   * Env: `REPORTING_LOGS_USE_LINES_FROM_SOURCE_CODE`.
   */
  useLinesFromSourceCode?: ZebrunnerFlag;
  /** Log message format. Defaults to `'structured'`. Env: `REPORTING_LOGS_FORMAT`. */
  format?: ZebrunnerLogFormat;
  /** Append each step's duration to its log message. Defaults to `true`. Env: `REPORTING_LOGS_INCLUDE_DURATION`. */
  includeDuration?: ZebrunnerFlag;
  /** Append the source location to each log message. Defaults to `true`. Env: `REPORTING_LOGS_INCLUDE_LOCATION`. */
  includeLocation?: ZebrunnerFlag;
  /**
   * Max source lines per log when `format` is `'source-line'`. Defaults to `3`.
   * Env: `REPORTING_LOGS_MAX_SOURCE_LINES`.
   */
  maxSourceLines?: ZebrunnerNumeric;
  /** Max log message length before truncation. Defaults to `8000`. Env: `REPORTING_LOGS_MAX_MESSAGE_LENGTH`. */
  maxMessageLength?: ZebrunnerNumeric;
  /** Do not attach `console.log` output from tests. Defaults to `false`. Env: `REPORTING_LOGS_IGNORE_CONSOLE`. */
  ignoreConsole?: ZebrunnerFlag;
  /** Do not attach `currentTest.log.*` messages. Defaults to `false`. Env: `REPORTING_LOGS_IGNORE_MANUAL`. */
  ignoreCustom?: ZebrunnerFlag;
  /**
   * Do not upload `currentTest.attachScreenshot()` screenshots. Defaults to `false`.
   * Env: `REPORTING_LOGS_IGNORE_CUSTOM_SCREENSHOTS`.
   */
  ignoreManualScreenshots?: ZebrunnerFlag;
  /**
   * Do not upload screenshots Playwright captures automatically. Defaults to `false`.
   * Env: `REPORTING_LOGS_IGNORE_AUTO_SCREENSHOTS`.
   */
  ignoreAutoScreenshots?: ZebrunnerFlag;
  /**
   * Upload buffered test logs every N milliseconds while the test is still running, instead of
   * only at test end. `0` (default) keeps the end-of-test upload. Values below 1000 are raised to
   * 1000. Artifacts, screenshots, videos and the test result are always sent at test end.
   * Env: `REPORTING_LOGS_FLUSH_INTERVAL_MS`.
   */
  flushIntervalMs?: ZebrunnerNumeric;
}

export interface ZebrunnerMilestoneOptions {
  /** Existing Zebrunner milestone id to attach the launch to. Env: `REPORTING_MILESTONE_ID`. */
  id?: number;
  /** Existing Zebrunner milestone name to attach the launch to. Env: `REPORTING_MILESTONE_NAME`. */
  name?: string;
}

export interface ZebrunnerNotificationsOptions {
  /**
   * Send a notification on every test failure instead of only when the launch finishes.
   * Env: `REPORTING_NOTIFICATION_NOTIFY_ON_EACH_FAILURE`.
   */
  notifyOnEachFailure?: ZebrunnerFlag;
  /** Comma-separated Slack channels. Env: `REPORTING_NOTIFICATION_SLACK_CHANNELS`. */
  slackChannels?: string;
  /** Comma-separated Microsoft Teams channels. Env: `REPORTING_NOTIFICATION_MS_TEAMS_CHANNELS`. */
  teamsChannels?: string;
  /** Comma-separated email recipients. Env: `REPORTING_NOTIFICATION_EMAILS`. */
  emails?: string;
}

/** Status names pushed to the TCM when a test case has no explicit status. Values are TCM-specific. */
export interface ZebrunnerTestCaseStatusOptions {
  /** Env: `REPORTING_TCM_TEST_CASE_STATUS_ON_PASS`. */
  onPass?: string;
  /** Env: `REPORTING_TCM_TEST_CASE_STATUS_ON_FAIL`. */
  onFail?: string;
  /** Env: `REPORTING_TCM_TEST_CASE_STATUS_ON_SKIP`. */
  onSkip?: string;
}

export interface ZebrunnerTcmOptions {
  /** Env: `REPORTING_TCM_ZEBRUNNER_PUSH_RESULTS`. */
  pushResults?: ZebrunnerFlag;
  /**
   * Push each result as soon as the test finishes instead of when the launch finishes.
   * Env: `REPORTING_TCM_ZEBRUNNER_PUSH_IN_REAL_TIME`.
   */
  pushInRealTime?: ZebrunnerFlag;
  /** Target Zebrunner TCM test run id. Env: `REPORTING_TCM_ZEBRUNNER_TEST_RUN_ID`. */
  testRunId?: ZebrunnerNumeric;
}

export interface TestRailTcmOptions {
  /** Env: `REPORTING_TCM_TESTRAIL_PUSH_RESULTS`. */
  pushResults?: ZebrunnerFlag;
  /**
   * Push each result as soon as the test finishes instead of when the launch finishes.
   * Env: `REPORTING_TCM_TESTRAIL_PUSH_IN_REAL_TIME`.
   */
  pushInRealTime?: ZebrunnerFlag;
  /** Env: `REPORTING_TCM_TESTRAIL_SUITE_ID`. */
  suiteId?: ZebrunnerNumeric;
  /** Existing TestRail run id. Omit to create a new run. Env: `REPORTING_TCM_TESTRAIL_RUN_ID`. */
  runId?: ZebrunnerNumeric;
  /** Env: `REPORTING_TCM_TESTRAIL_INCLUDE_ALL_IN_NEW_RUN`. */
  includeAllTestCasesInNewRun?: ZebrunnerFlag;
  /** Name for the newly created run. Env: `REPORTING_TCM_TESTRAIL_RUN_NAME`. */
  runName?: string;
  /** Env: `REPORTING_TCM_TESTRAIL_MILESTONE_NAME`. */
  milestoneName?: string;
  /** Env: `REPORTING_TCM_TESTRAIL_ASSIGNEE`. */
  assignee?: string;
}

export interface XrayTcmOptions {
  /** Env: `REPORTING_TCM_XRAY_PUSH_RESULTS`. */
  pushResults?: ZebrunnerFlag;
  /**
   * Push each result as soon as the test finishes instead of when the launch finishes.
   * Env: `REPORTING_TCM_XRAY_PUSH_IN_REAL_TIME`.
   */
  pushInRealTime?: ZebrunnerFlag;
  /** Xray test execution key, e.g. `JIRA-123`. Env: `REPORTING_TCM_XRAY_EXECUTION_KEY`. */
  executionKey?: string;
}

export interface ZephyrTcmOptions {
  /** Env: `REPORTING_TCM_ZEPHYR_PUSH_RESULTS`. */
  pushResults?: ZebrunnerFlag;
  /**
   * Push each result as soon as the test finishes instead of when the launch finishes.
   * Env: `REPORTING_TCM_ZEPHYR_PUSH_IN_REAL_TIME`.
   */
  pushInRealTime?: ZebrunnerFlag;
  /** Env: `REPORTING_TCM_ZEPHYR_JIRA_PROJECT_KEY`. */
  jiraProjectKey?: string;
  /** Env: `REPORTING_TCM_ZEPHYR_TEST_CYCLE_KEY`. */
  testCycleKey?: string;
}

/** Test case management integrations the launch results are pushed to. */
export interface TcmOptions {
  testCaseStatus?: ZebrunnerTestCaseStatusOptions;
  zebrunner?: ZebrunnerTcmOptions;
  testRail?: TestRailTcmOptions;
  xray?: XrayTcmOptions;
  zephyr?: ZephyrTcmOptions;
}

/**
 * Options accepted by the Zebrunner Playwright reporter.
 *
 * Every option can also be set through the environment variable named in its
 * description; the environment variable wins over the value from this object.
 *
 * ```ts
 * import { defineConfig } from '@playwright/test';
 * import { zebrunnerReporter } from '@zebrunner/javascript-agent-playwright';
 *
 * export default defineConfig({
 *   reporter: [zebrunnerReporter({
 *     enabled: true,
 *     projectKey: 'DEF',
 *     server: { hostname: 'https://mycompany.zebrunner.com', accessToken: process.env.ZBR_TOKEN },
 *   })],
 * });
 * ```
 */
export interface ZebrunnerReporterOptions {
  /**
   * Master switch. When `false` the reporter only prints to the console. Defaults to `false`.
   * Env: `REPORTING_ENABLED`.
   */
  enabled?: ZebrunnerFlag;
  /** Zebrunner project key the launch is reported to. Defaults to `'DEF'`. Env: `REPORTING_PROJECT_KEY`. */
  projectKey?: string;
  server?: ZebrunnerServerOptions;
  launch?: ZebrunnerLaunchOptions;
  logs?: ZebrunnerLogsOptions;
  milestone?: ZebrunnerMilestoneOptions;
  notifications?: ZebrunnerNotificationsOptions;
  tcm?: TcmOptions;
}

export interface ServerConfig {
  readonly hostname: string;
  readonly accessToken: string;
}

export interface LaunchConfig {
  readonly displayName: string;
  readonly build: string;
  readonly environment: string;
  readonly locale: string;
  readonly treatSkipsAsFailures: boolean;
}

export interface LogsConfig {
  readonly ignorePlaywrightSteps: boolean;
  readonly includeHooks: boolean;
  readonly includeFixtures: boolean;
  readonly includeBridgeActions: boolean;
  readonly useLinesFromSourceCode: boolean;
  readonly format: ZebrunnerLogFormat;
  readonly includeDuration: boolean;
  readonly includeLocation: boolean;
  readonly maxSourceLines: number;
  readonly maxMessageLength: number;
  readonly ignoreConsole: boolean;
  readonly ignoreCustom: boolean;
  readonly ignoreManualScreenshots: boolean;
  readonly ignoreAutoScreenshots: boolean;
  readonly flushIntervalMs: number;
}

export interface MilestoneConfig {
  readonly idFromConfig: number;
  readonly idFromEnv: number;
  readonly nameFromConfig: string;
  readonly nameFromEnv: string;
}

export interface NotificationsConfig {
  readonly notifyOnEachFailure: boolean;

  readonly slackChannels: string;
  readonly teamsChannels: string;
  readonly emails: string;
}

export interface Tcm {
  readonly testCaseStatus: TestCaseStatus;

  readonly zebrunner: ZebrunnerTcm;
  readonly testRail: TestRailTcm;
  readonly xray: XrayTcm;
  readonly zephyr: ZephyrTcm;
}

export interface TestCaseStatus {
  readonly onPass: string;
  readonly onFail: string;
  readonly onSkip: string;
}

export interface ZebrunnerTcm {
  readonly pushResults: boolean;
  readonly pushInRealTime: boolean;

  readonly testRunId: number;
}

export interface TestRailTcm {
  readonly pushResults: boolean;
  readonly pushInRealTime: boolean;

  readonly suiteId: number;
  readonly runId: number;

  readonly includeAllTestCasesInNewRun: boolean;
  readonly runName: string;
  readonly milestoneName: string;
  readonly assignee: string;
}

export interface XrayTcm {
  readonly pushResults: boolean;
  readonly pushInRealTime: boolean;

  readonly executionKey: string;
}

export interface ZephyrTcm {
  readonly pushResults: boolean;
  readonly pushInRealTime: boolean;

  readonly jiraProjectKey: string;
  readonly testCycleKey: string;
}
