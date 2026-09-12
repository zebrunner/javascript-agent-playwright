import ZebrunnerReporter from './ZebrunnerReporter';
import { ZebrunnerReporterOptions } from './ReportingConfig/types';

export { currentTest } from './currentTest';
export { currentLaunch } from './currentLaunch';
export { testRail, xray, zebrunner, zephyr } from './tcm';

export type {
  ZebrunnerReporterOptions,
  ZebrunnerServerOptions,
  ZebrunnerServerRequestOptions,
  ZebrunnerLaunchOptions,
  ZebrunnerLogsOptions,
  ZebrunnerConsoleOptions,
  ZebrunnerMilestoneOptions,
  ZebrunnerNotificationsOptions,
  ZebrunnerTestSessionOptions,
  TcmOptions,
  ZebrunnerTestCaseStatusOptions,
  ZebrunnerTcmOptions,
  TestRailTcmOptions,
  XrayTcmOptions,
  ZephyrTcmOptions,
  ZebrunnerFlag,
  ZebrunnerNumeric,
  ZebrunnerLogFormat,
  ZebrunnerConsoleLogLevel,
} from './ReportingConfig/types';

const REPORTER_MODULE_NAME = '@zebrunner/javascript-agent-playwright';

/**
 * Builds a type-checked entry for the Playwright `reporter` array.
 *
 * ```ts
 * import { defineConfig } from '@playwright/test';
 * import { zebrunnerReporter } from '@zebrunner/javascript-agent-playwright';
 *
 * export default defineConfig({
 *   reporter: [zebrunnerReporter({ enabled: true, projectKey: 'DEF' })],
 * });
 * ```
 */
export function zebrunnerReporter(options: ZebrunnerReporterOptions = {}): [string, ZebrunnerReporterOptions] {
  return [REPORTER_MODULE_NAME, options];
}

export default ZebrunnerReporter;
