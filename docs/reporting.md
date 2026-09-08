# Reporter guide

This guide covers reporter configuration, runtime helpers, log behavior, and
client resource use.

## Requirements

- Node.js 18 or newer
- Playwright Test

Install the reporter:

```bash
npm install --save-dev @zebrunner/javascript-agent-playwright
```

## Configure the reporter

Configure the reporter as a Playwright reporter option. Prefer the typed helper
when editing TypeScript configs.

The example below shows the available options with sample values. The values are
not the defaults. For each option default, see the sections after the examples.

```ts
import { zebrunnerReporter } from '@zebrunner/javascript-agent-playwright';

reporter: [
  zebrunnerReporter({
    enabled: true,
    projectKey: 'DEF',
    server: {
      hostname: process.env.REPORTING_SERVER_HOSTNAME,
      accessToken: process.env.REPORTING_SERVER_ACCESS_TOKEN,
    },
    launch: {
      displayName: 'Playwright tests',
      build: 'local',
      environment: 'staging',
      locale: 'en_US',
      treatSkipsAsFailures: true,
    },
    logs: {
      format: 'playwright-title',
      includeHooks: false,
      includeFixtures: false,
      includeBridgeActions: true,
      includeDuration: false,
      includeLocation: false,
      maxSourceLines: 3,
      maxMessageLength: 8000,
      flushIntervalMs: 0,
      ignorePlaywrightSteps: false,
      ignoreConsole: false,
      ignoreCustom: false,
      ignoreManualScreenshots: false,
      ignoreAutoScreenshots: false,
    },
  }),
],
```

The equivalent array form still works:

```js
reporter: [[
  '@zebrunner/javascript-agent-playwright',
  {
    enabled: true,
    projectKey: 'DEF',
    server: {
      hostname: process.env.REPORTING_SERVER_HOSTNAME,
      accessToken: process.env.REPORTING_SERVER_ACCESS_TOKEN,
    },
    launch: {
      displayName: 'Playwright tests',
      build: 'local',
      environment: 'staging',
      locale: 'en_US',
      treatSkipsAsFailures: true,
    },
    logs: {
      format: 'playwright-title',
      includeHooks: false,
      includeFixtures: false,
      includeBridgeActions: true,
      includeDuration: false,
      includeLocation: false,
      maxSourceLines: 3,
      maxMessageLength: 8000,
      ignorePlaywrightSteps: false,
      ignoreConsole: false,
      ignoreCustom: false,
      ignoreManualScreenshots: false,
      ignoreAutoScreenshots: false,
    },
  },
]],
```

Environment variables override values from `playwright.config.js`.

## Core settings

- `enabled`: enables Zebrunner reporting. Default: `false`.
  Environment: `REPORTING_ENABLED`.
- `projectKey`: Zebrunner project key. Default: `DEF`.
  Environment: `REPORTING_PROJECT_KEY`.
- `server.hostname`: Zebrunner server URL.
  Environment: `REPORTING_SERVER_HOSTNAME`.
- `server.accessToken`: Zebrunner access token.
  Environment: `REPORTING_SERVER_ACCESS_TOKEN`.

Provide both server values when reporting is enabled.

## Launch settings

- `launch.displayName`: launch name. Defaults to the npm package name or
  `Default Suite`. Environment: `REPORTING_LAUNCH_DISPLAY_NAME`.
- `launch.build`: build identifier. Environment: `REPORTING_LAUNCH_BUILD`.
- `launch.environment`: execution environment.
  Environment: `REPORTING_LAUNCH_ENVIRONMENT`.
- `launch.locale`: launch locale. Environment: `REPORTING_LAUNCH_LOCALE`.
- `launch.treatSkipsAsFailures`: reports skipped tests as failures.
  Default: `true`. Environment: `REPORTING_LAUNCH_TREAT_SKIPS_AS_FAILURES`.

## Log formats

`logs.format` controls how Playwright test steps are rendered.

### `structured`

The default and most detailed format. It can include:

- Playwright action title
- duration
- source location
- bounded source snippet
- deduplicated failure details

Example:

```text
Fill "pasted" locator("#kbd-input") [339ms]
  source: await input.fill('pasted');
  at: test/specs/locator-input.spec.js:242:17
```

Use `includeDuration`, `includeLocation`, and `maxSourceLines` to control the
extra details.

### `playwright-title`

Uses the concise title produced by Playwright.

Example:

```text
Fill "pasted" locator("#kbd-input")
```

Failure details remain attached to failed steps.

### `source-line`

Uses a bounded source-code snippet from the test file, with the Playwright
title as a fallback.

Example:

```text
await input.fill('pasted');
```

Failure details remain attached to failed steps.

Set the format through `REPORTING_LOGS_FORMAT`.

## Log filtering

- `logs.ignorePlaywrightSteps`: hides all native Playwright steps.
  Default: `false`. Environment: `REPORTING_LOGS_IGNORE_PLAYWRIGHT_STEPS`.
- `logs.includeHooks`: includes `Before Hooks`, `After Hooks`, their nested
  steps, and runtime actions occurring inside those hook ranges.
  Default: `false`. Environment: `REPORTING_LOGS_INCLUDE_HOOKS`.
- `logs.includeFixtures`: includes Playwright fixture steps and structured
  library lifecycle actions tagged as fixtures.
  Default: `false`. Environment: `REPORTING_LOGS_INCLUDE_FIXTURES`.
- `logs.includeBridgeActions`: includes enriched `page.bridge.*` actions.
  Default: `false`. Environment: `REPORTING_LOGS_INCLUDE_BRIDGE_ACTIONS`.

## Log details and limits

- `logs.includeDuration`: adds action duration in structured mode.
  Default: `true`. Environment: `REPORTING_LOGS_INCLUDE_DURATION`.
- `logs.includeLocation`: adds source file, line, and column in structured
  mode. Default: `true`. Environment: `REPORTING_LOGS_INCLUDE_LOCATION`.
- `logs.maxSourceLines`: maximum source lines used to build a structured or
  source-line snippet. Default: `3`.
  Environment: `REPORTING_LOGS_MAX_SOURCE_LINES`.
- `logs.maxMessageLength`: maximum size of one log message before truncation.
  Default: `8000`. Environment: `REPORTING_LOGS_MAX_MESSAGE_LENGTH`.
- `logs.flushIntervalMs`: upload buffered test logs every N milliseconds while
  the test still runs. `0` (default) keeps the end-of-test log upload. Values
  below `1000` are raised to `1000`.
  Environment: `REPORTING_LOGS_FLUSH_INTERVAL_MS`.

## Console, custom logs, and screenshots

- `logs.ignoreConsole`: ignores `console.log` output from tests.
  Default: `false`. Environment: `REPORTING_LOGS_IGNORE_CONSOLE`.
- `logs.ignoreCustom`: ignores logs emitted through `currentTest.log`.
  Default: `false`. Environment: `REPORTING_LOGS_IGNORE_MANUAL`.
- `logs.ignoreManualScreenshots`: ignores screenshots emitted through
  `currentTest.attachScreenshot`. Default: `false`.
  Environment: `REPORTING_LOGS_IGNORE_CUSTOM_SCREENSHOTS`.
- `logs.ignoreAutoScreenshots`: does not upload Playwright-generated
  screenshots. Default: `false`.
  Environment: `REPORTING_LOGS_IGNORE_AUTO_SCREENSHOTS`.

## Legacy source-line option

`logs.useLinesFromSourceCode` and
`REPORTING_LOGS_USE_LINES_FROM_SOURCE_CODE` remain available for compatibility.

When `logs.format` is absent:

- `useLinesFromSourceCode: true` maps to `source-line`.
- `useLinesFromSourceCode: false` maps to `playwright-title`.
- if the legacy option is also absent, the reporter defaults to `structured`.

When `logs.format` is present, it takes precedence.

## Milestone settings

- `milestone.id`: milestone ID. Environment: `REPORTING_MILESTONE_ID`.
- `milestone.name`: milestone name. Environment: `REPORTING_MILESTONE_NAME`.

## Notification settings

- `notifications.notifyOnEachFailure`: sends a notification for every failure.
  Environment: `REPORTING_NOTIFICATION_NOTIFY_ON_EACH_FAILURE`.
- `notifications.slackChannels`: Slack channels.
  Environment: `REPORTING_NOTIFICATION_SLACK_CHANNELS`.
- `notifications.teamsChannels`: Microsoft Teams channels.
  Environment: `REPORTING_NOTIFICATION_MS_TEAMS_CHANNELS`.
- `notifications.emails`: notification email addresses.
  Environment: `REPORTING_NOTIFICATION_EMAILS`.

## Test case management settings

Common result statuses:

- `tcm.testCaseStatus.onPass`
  (`REPORTING_TCM_TEST_CASE_STATUS_ON_PASS`)
- `tcm.testCaseStatus.onFail`
  (`REPORTING_TCM_TEST_CASE_STATUS_ON_FAIL`)
- `tcm.testCaseStatus.onSkip`
  (`REPORTING_TCM_TEST_CASE_STATUS_ON_SKIP`)

Zebrunner TCM:

- `tcm.zebrunner.pushResults`
  (`REPORTING_TCM_ZEBRUNNER_PUSH_RESULTS`)
- `tcm.zebrunner.pushInRealTime`
  (`REPORTING_TCM_ZEBRUNNER_PUSH_IN_REAL_TIME`)
- `tcm.zebrunner.testRunId`
  (`REPORTING_TCM_ZEBRUNNER_TEST_RUN_ID`)

TestRail:

- `tcm.testRail.pushResults`
  (`REPORTING_TCM_TESTRAIL_PUSH_RESULTS`)
- `tcm.testRail.pushInRealTime`
  (`REPORTING_TCM_TESTRAIL_PUSH_IN_REAL_TIME`)
- `tcm.testRail.suiteId`
  (`REPORTING_TCM_TESTRAIL_SUITE_ID`)
- `tcm.testRail.runId`
  (`REPORTING_TCM_TESTRAIL_RUN_ID`)
- `tcm.testRail.includeAllTestCasesInNewRun`
  (`REPORTING_TCM_TESTRAIL_INCLUDE_ALL_IN_NEW_RUN`)
- `tcm.testRail.runName`
  (`REPORTING_TCM_TESTRAIL_RUN_NAME`)
- `tcm.testRail.milestoneName`
  (`REPORTING_TCM_TESTRAIL_MILESTONE_NAME`)
- `tcm.testRail.assignee`
  (`REPORTING_TCM_TESTRAIL_ASSIGNEE`)

Xray:

- `tcm.xray.pushResults` (`REPORTING_TCM_XRAY_PUSH_RESULTS`)
- `tcm.xray.pushInRealTime`
  (`REPORTING_TCM_XRAY_PUSH_IN_REAL_TIME`)
- `tcm.xray.executionKey` (`REPORTING_TCM_XRAY_EXECUTION_KEY`)

Zephyr:

- `tcm.zephyr.pushResults` (`REPORTING_TCM_ZEPHYR_PUSH_RESULTS`)
- `tcm.zephyr.pushInRealTime`
  (`REPORTING_TCM_ZEPHYR_PUSH_IN_REAL_TIME`)
- `tcm.zephyr.jiraProjectKey`
  (`REPORTING_TCM_ZEPHYR_JIRA_PROJECT_KEY`)
- `tcm.zephyr.testCycleKey`
  (`REPORTING_TCM_ZEPHYR_TEST_CYCLE_KEY`)

## Runtime helpers

Import `currentTest` when a test must send data during execution:

```ts
import { currentTest } from '@zebrunner/javascript-agent-playwright';
```

### Attach files

The attachment helpers accept a file path or a `Buffer`:

```ts
currentTest.attachScreenshot(await page.screenshot());
currentTest.attachVideo('artifacts/test-video.mp4', 'test-video.mp4');
currentTest.attachArtifact('artifacts/network.har', 'network.har');
```

- `attachScreenshot(pathOrBuffer)` attaches a Portable Network Graphics (PNG)
  screenshot.
- `attachVideo(pathOrBuffer, name?)` attaches a video.
- `attachArtifact(pathOrBuffer, name?)` attaches another file type.

For a buffer, the reporter writes a temporary file before upload. It removes
that file after a successful upload. Each test uploads one manual screenshot at
a time.

`page.screenshot()` creates a buffer in the Playwright worker. The V8 engine can
keep this memory until the worker exits.

### Attach runtime actions

Use `currentTest.attachAction()` for a tool or integration that records actions
outside the standard Playwright step stream.

Each action has these fields:

- An optional stable `id`
- A `kind`: `playwright`, `bridge`, `appium`, or `fixture`
- A `method`
- Optional bounded `params`
- Start and end timestamps
- A `status`: `started`, `passed`, or `failed`
- An optional source location or error

Send the same action ID for its start and completion events. Send parameters on
the start event. The reporter summarizes buffers, typed arrays, and large
values. It also handles circular values.

The reporter removes known credentials, authorization headers, cookies,
sensitive query parameters, and input values before upload.

### Attach remote session metadata

Use `currentTest.attachSessionCapabilities()` to associate browser and platform
data with a test:

```ts
currentTest.attachSessionCapabilities(
  {
    browserName: 'chrome',
    browserVersion: '140',
    platformName: 'Android',
    platformVersion: '16',
    deviceName: 'Pixel 7',
    'zebrunner:provider': 'remote-device-provider',
  },
  'provider-session-id',
);
```

The session ID is optional. The `zebrunner:provider` capability sets display
metadata only. A compatible remote service can use the session ID to associate
available logs or video with the test.

The local and remote fixture calls this function for you. A remote run attaches
the grid session browser and session id. A local run attaches the local browser
and the host operating system. Call the function yourself only for a custom
provider that the fixture does not manage.

The reporter resets session data and artifacts for each retry. Data from an
earlier attempt does not enter the next attempt.

## Worker and artifact resources

The Playwright `workers` value has the largest effect on client memory use.
Each parallel test has one Node.js worker, even when the browser runs on a
remote device.

Reduce `workers` when the client has limited memory:

```ts
export default defineConfig({
  workers: process.env.CI_WORKERS
    ? Number(process.env.CI_WORKERS)
    : undefined,
});
```

Select a value that leaves memory for the operating system, test data, traces,
and artifacts. Measure the peak for your test suite before you increase
parallel execution.

## Runtime behavior

If `includeHooks` is `false`, the reporter omits actions inside setup and
teardown hooks. Actions in the test body remain available under their related
options.

If a test times out during an unfinished action, the reporter completes that
action with an `ERROR` result. It keeps the Playwright timeout reason.

## Reruns

Zebrunner can rerun only the failed tests of a launch. For a rerun, Zebrunner
sets `REPORTING_RUN_CONTEXT`. The reporter exchanges this context to learn which
tests to run again.

Playwright fixes its run plan before the reporter starts, so the reporter cannot
narrow the run on its own. The agent scopes the rerun earlier, before Playwright
parses its command line. Preload the agent module with `NODE_OPTIONS` so it can
add a `--test-list` argument:

```bash
NODE_OPTIONS="--import ./node_modules/@zebrunner/javascript-agent-playwright/build/javascript-agent-playwright/preload.mjs" \
  npx playwright test
```

The preload reads `REPORTING_RUN_CONTEXT`, gets the tests to run again, and adds
the `--test-list` argument. It scopes the run correctly for a named project, no
project, and a duplicated project name. Without the preload, a rerun runs the
full suite. A normal run (no `REPORTING_RUN_CONTEXT`) is not affected.

## Reporter shutdown timeouts

These environment variables tune reporter behavior outside the main config
object:

- `ZBR_FINISH_WAIT_TIMEOUT_MS` sets the normal finish wait. The default is
  `60000`.
- `ZBR_ABORT_FINISH_TIMEOUT_MS` sets the abort finish wait. The default is
  `10000`.
- `ZBR_CONSOLE_ONLY_PREFIX` (default `reporting-agent:`) keeps diagnostic stdout
  visible in the run output without attaching it as a Zebrunner test log
- `ZBR_LOG_VERBOSE` expands reporter diagnostics and stack traces when set to
  `1`
