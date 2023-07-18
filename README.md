# Zebrunner Playwright reporting agent

This agent was originally developed by [Ryan Rosello](https://github.com/ryanrosello-og).

## Inclusion into your project

### Adding dependency

First, you need to add the Zebrunner Agent into your `package.json`.

=== "Yarn"

    ```shell
    yarn add @zebrunner/javascript-agent-playwright
    ```

=== "NPM"

    ```shell
    npm install @zebrunner/javascript-agent-playwright
    ```

### Reporter setup

The agent does not work automatically after adding it into the project, it requires extra configuration. For this, you need to perform the following steps:

1. Navigate to the Playwright configuration file (by default, it is `playwright.config.ts`) and provide the following information:
- Add `@zebrunner/javascript-agent-playwright` to the list of reporters;
- Provide the reporter configuration (you can find more about the configuration in the next section). The reporter must be specified in a nested array. The first array element is `@zebrunner/javascript-agent-playwright`, the second element is a reporter configuration object. 

Here is an example of a configuration snippet:

```ts title="playwright.config.ts"
export default defineConfig({
  testDir: './tests', 
  reporter: [
    [
      '@zebrunner/javascript-agent-playwright',
      {
        // Zebrunner reporter configuration
        enabled: true,
        // ...
      },
    ],
  ],
});
```

## Reporter configuration

Once the agent is added into your project, it is **not** automatically enabled. The valid configuration must be provided first.

It is currently possible to provide the configuration via:

1. Environment variables
2. Playwright config (`playwright.config.ts` file)

The configuration lookup will be performed in the order listed above, meaning that environment configuration will always take precedence over `playwright.config.ts` file. As a result, it is possible to override configuration parameters by passing them through a configuration mechanism with higher precedence.

It is currently possible to provide the configuration via:
- `Environment variables`
- `Playwright config`

### Environment variables / Reporter config

#### Common configuration

- `REPORTING_ENABLED` / `enabled` - `mandatory`: enables or disables reporting. The default value is `false`. If disabled, the agent will use no op component implementations that will simply log output for tracing purposes with the trace level;
- `REPORTING_SERVER_HOSTNAME` / `reportingServerHostname` - `mandatory` if reporting is enabled. It is your Zebrunner hostname, e.g. `https://mycompany.zebrunner.com`;
- `REPORTING_SERVER_ACCESS_TOKEN` / `reportingServerAccessToken` - `mandatory` if reporting is enabled. The access token is used to perform API calls. It can be obtained in Zebrunner on the 'Account and profile' page in the 'API Access' section;
- `REPORTING_PROJECT_KEY` / `reportingProjectKey` - `optional` value. It is the key of Zebrunner project that the launch belongs to. The default value is `DEF`;
- `PW_CONCURRENT_TASKS` / `pwConcurrentTasks` - `optional` value. Special value for `@supercharge/promise-pool` lib. By default `10`.

#### Automation launch configuration

- `REPORTING_RUN_DISPLAY_NAME` / `reportingRunDisplayName` - `optional` value. Display name of the launch in Zebrunner. The default value is `Default Suite`;
- `REPORTING_RUN_BUILD` / `reportingRunBuild` - `optional` value. Build number associated with the launch. It can reflect either the test build number or the build number of the application under test;
- `REPORTING_RUN_ENVIRONMENT` / `reportingRunEnvironment` - `optional` value. Represents the target environment in which the tests were run. For example, `stage` or `prod`.

#### Milestone

- `REPORTING_MILESTONE_ID` / `reportingMilestoneId` - `optional` value. Id of the Zebrunner Milestone to link the automation launch to. The id is not displayed on Zebrunner UI, so the field is basically used for internal purposes. If the milestone does not exist, the launch will continue executing;
- `REPORTING_MILESTONE_NAME` / `reportingMilestoneName` - `optional` value. Name of the Zebrunner Milestone to link the automation launch to. If the milestone does not exist, the appropriate warning message will be displayed in logs, but the test suite will continue executing.

#### Notifications

- `REPORTING_NOTIFICATION_NOTIFY_ON_EACH_FAILURE` / `reportingNotificationNotifyOnEachFailure` - `optional` value. Specifies whether Zebrunner should send notifications to Slack/Teams on each test failure. The notifications will be sent even if the launch is still running. The default value is `false`;
- `REPORTING_NOTIFICATION_SLACK_CHANNELS` / `reportingNotificationSlackChannels` - `optional` value. A comma-separated list of Slack channels to send notifications to. Notifications will be sent only if the Slack integration is properly configured in Zebrunner with valid credentials for the project the launch is reported to. Zebrunner can send two types of notifications: on each test failure (if the appropriate property is enabled) and on the launch finish;
- `REPORTING_NOTIFICATION_MS_TEAMS_CHANNELS` / `reportingNotificationMsTeamsChannels` - `optional` value. A comma-separated list of Microsoft Teams channels to send notifications to. Notifications will be sent only if the Teams integration is configured in the Zebrunner project with valid webhooks for the channels. Zebrunner can send two types of notifications: on each test failure (if the appropriate property is enabled) and on the launch finish;
- `REPORTING_NOTIFICATION_EMAILS` / `reportingNotificationEmails` - `optional` value. A comma-separated list of emails to send notifications to. This type of notifications does not require further configuration on Zebrunner side. Unlike other notification mechanisms, Zebrunner can send emails only on the launch finish.


### Examples

#### Environment Variables

The following code snippet is a list of all configuration environment variables from `.env` file:

```text
   REPORTING_ENABLED=true
   REPORTING_PROJECT_KEY=DEF
   REPORTING_SERVER_HOSTNAME=https://mycompany.zebrunner.com
   REPORTING_SERVER_ACCESS_TOKEN=somesecretaccesstoken
   PW_CONCURRENT_TASKS=10
   
   REPORTING_RUN_DISPLAY_NAME=Nightly Regression
   REPORTING_RUN_BUILD=2.41.2.2431-SNAPSHOT
   REPORTING_RUN_ENVIRONMENT=QA
   
   REPORTING_MILESTONE_ID=1
   REPORTING_MILESTONE_NAME=Release 1.0.0
   
   REPORTING_NOTIFICATION_NOTIFY_ON_EACH_FAILURE=false
   REPORTING_NOTIFICATION_SLACK_CHANNELS=dev, qa
   REPORTING_NOTIFICATION_MS_TEAMS_CHANNELS=dev-channel, management
   REPORTING_NOTIFICATION_EMAILS=manager@mycompany.com
```

#### Configuration file

Below you can see an example of the full configuration provided via `playwright.config.ts` file:

```ts title="playwright.config.ts"
export default defineConfig({
  testDir: './tests', 
  reporter: [
    [
      '@zebrunner/javascript-agent-playwright',
      {
        enabled: true,
        reportingServerHostname: 'https://mycompany.zebrunner.com',
        reportingServerAccessToken: 'somesecretaccesstoken',
        reportingProjectKey: 'DEF',
        reportingRunDisplayName: 'Playwright Regression',
        reportingRunBuild: 'alpha-1',
        reportingRunEnvironment: 'STAGE',
        reportingNotificationNotifyOnEachFailure: true,
        reportingNotificationSlackChannels: 'channel1,channel2',
        reportingNotificationMsTeamsChannels: 'channel1,channel2',
        reportingNotificationEmails: 'manager@mycompany.com',
        reportingMilestoneId: '1',
        reportingMilestoneName: 'test',
        pwConcurrentTasks: 19,
       },
    ],
  ],
});
```

## Additional Playwright configuration

It is highly recommended to add following additional configuration to your `playwright.config.ts` config file:

- enable taking a screenshot on failure feature, video and trace that will allow to send them into Zebrunner Reporting:

```ts title="playwright.config.ts"
  use: {
    screenshot: 'only-on-failure',
    video: 'on',
    trace: 'on',
  },
```

- enable detection of `browser` and `os` settings that will be sent to Zebrunner:

```ts title="playwright.config.ts"
projects: [
    ...
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    ...
  ],
```

## Tracking test maintainer

You may want to add transparency to the process of automation maintenance by having an engineer responsible for evolution of specific tests or test suites. To serve that purpose, Zebrunner comes with a concept of a maintainer.

In order to keep track of those, the Agent comes with the `#setMaintainer()` method of the `ZebEmitter` object. This method accepts the username of an existing Zebrunner user. If there is no user with the given username, `anonymous` will be assigned.

```ts
import { test, expect, Page } from '@playwright/test';
const { firefox } = require('playwright');
import { ZebEmitter } from '@zebrunner/javascript-agent-playwright';

test.describe('Test suite', () => {
  
  test.beforeEach(async ({page}) => {
    // ...
  });

  test('first test', async ({page}) => {
    ZebEmitter.setMaintainer('developer');
    // ...
  });

  test('second test', async ({page}) => {
    ZebEmitter.setMaintainer('tester');
    // ...
  });
});
```

In this example, `developer` will be reported as a maintainer of `first test` , while `tester` will be reported as a maintainer of the `second test`.

## Attaching labels to test

In some cases, it may be useful to attach meta information related to a test. You can attach labels, by writing them in the name of the test through `@`:

```ts
test('test running in Firefox @ff @smoke_test @slow', async ({page}, testInfo) => {
    const browser = await firefox.launch();
    const page1 = await browser.newPage();
    await page1.goto('https://example.com');
    await browser.close();
});
```

After test execution you can see the labels `ff`,`smoke_test`,`slow` in Zebrunner for particular test.

## Upload test results to external test case management systems

Zebrunner provides an ability to upload test results to external TCMs on test run finish. For some TCMs it is possible to upload results in real-time during the test run execution.

Currently, Zebrunner supports TestRail, Xray, Zephyr Squad and Zephyr Scale test case management systems.

### TestRail

For successful upload of test run results in TestRail, two steps must be performed:

- Integration with TestRail is configured and enabled for Zebrunner project;
- Configuration is performed on the tests side.


#### Configuration

Zebrunner agent has a special TestRail class with a bunch of methods to control results upload:

- `setSuiteId`(string) - `mandatory`. The method sets TestRail suite id for current test run. This method must be invoked before all tests;
- `setCaseId`(array of strings) - `mandatory`. Using these mechanisms you can set TestRail's case associated with specific automated test;
- `disableSync`(boolean) - `optional`. Disables result upload. Same as `setSuiteId`(string), this method must be invoked before all tests;
- `includeAllTestCasesInNewRun`(boolean) - `optional`. Includes all cases from suite into newly created run in TestRail. Same as `setSuiteId`(string), this method must be invoked before all tests;
- `enableRealTimeSync`(boolean) - `optional`. Enables real-time results upload. In this mode, result of test execution will be uploaded immediately after test finish. This method also automatically invokes `includeAllTestCasesInNewRun`. Same as `setSuiteId`(string), this method must be invoked before all tests;
- `setRunId`(string) - `optional`. Adds result into existing TestRail run. If not provided, test run is treated as new. Same as `setSuiteId`(string), this method must be invoked before all tests;
- `setRunName`(string) - `optional`. Sets custom name for new TestRail run. By default, Zebrunner test run name is used. Same as `setSuiteId`(string), this method must be invoked before all tests;
- `setMilestone`(string) - `optional`. Adds result in TestRail milestone with the given name. Same as `setSuiteId`(string), this method must be invoked before all tests;
- `setAssignee`(string) - optional. Sets TestRail run assignee. Same as `setSuiteId`(string), this method must be invoked before all tests.

By default, a new run containing only cases assigned to the tests will be created in TestRail on test launch finish.

Example:

```ts
import { test, expect, Page } from '@playwright/test';
const { firefox } = require('playwright');
import { ZebEmitter } from '@zebrunner/javascript-agent-playwright';

test.beforeAll(async () => {
  const tcmRunOptions = [
    {
      testRailSuiteId: 'testRailSuite',
      testRailRunId: '322',
      testRailRunName: 'testRailName',
      testRailMilestone: 'milestone',
      testRailAssignee: 'emarf',
      testRailDisableSync: true,
      testRailIncludeAll: true,
      testRailEnableRealTimeSync: true,
    },
  ]

  ZebEmitter.addTcmRunOptions(tcmRunOptions);
})

test.describe('nested foo', () => {
  test('test running in Firefox @ff @smoke_test @slow', async ({page}, testInfo) => {
    const tcmTestOptions = [
      {
        testRailCaseId: ['caseId', 'caseId1'],
      },
    ];
    ZebEmitter.addTcmTestOptions(tcmTestOptions);

    const browser = await firefox.launch();
    const page1 = await browser.newPage();
    await page1.goto('https://example.com');
    await browser.close();
  });
};
```

### Xray

For successful upload of test run results in Xray two steps must be performed:

- Xray integration is configured and enabled in Zebrunner project
- Xray configuration is performed on the tests side

#### Configuration

Zebrunner agent has a special Xray class with a bunch of methods to control results upload:

- `setExecutionKey`(string) - `mandatory`. The method sets Xray execution key. This method must be invoked before all tests.
- `setTestKey`(array of string) - `mandatory`. Using these mechanisms you can set test keys associated with specific automated test.
- `disableSync`(boolean) - `optional`. Disables result upload. Same as `setExecutionKey`(string), this method must be invoked before all tests;
- `enableRealTimeSync`(boolean) - `optional`. Enables real-time results upload. In this mode, result of test execution will be uploaded immediately after test finish. Same as `setExecutionKey`(string), this method must be invoked before all tests.

By default, results will be uploaded to Xray on test launch finish.

Example: 

```ts
import { test, expect, Page } from '@playwright/test';
const { firefox } = require('playwright');
import { ZebEmitter } from '@zebrunner/javascript-agent-playwright';

test.beforeAll(async () => {
  const tcmRunOptions = [
    {
      xrayExecutionKey: 'execKey',
      xrayDisableSync: true,
      xrayEnableRealTimeSync: true
    },
  ]

  ZebEmitter.addTcmRunOptions(tcmRunOptions);
})

test.describe('nested foo', () => {
  test('test running in Firefox @ff @smoke_test @slow', async ({page}, testInfo) => {
    const tcmTestOptions = [
      {
        xrayTestKey: ['testKey', 'testKey1'],
      },
    ];
    ZebEmitter.addTcmTestOptions(tcmTestOptions);

    const browser = await firefox.launch();
    const page1 = await browser.newPage();
    await page1.goto('https://example.com');
    await browser.close();
  });
};
```

### Zephyr Squad & Zephyr Scale

For successful upload of test run results in Zephyr two steps must be performed:

- Zephyr integration is configured and enabled in Zebrunner project
- Zephyr configuration is performed on the tests side

#### Configuration

- `setTestCycleKey`(string) - `mandatory`. The method sets Zephyr test cycle key. This method must be invoked before all tests;
- `setJiraProjectKey`(string) - `mandatory`. Sets Zephyr Jira project key. Same as `setTestCycleKey`(string), this method must be invoked before all tests;
- `setTestCaseKey`(array of string) - `mandatory`. Using these mechanisms you can set test case keys associated with specific automated test;
- `disableSync`() - `optional`. Disables result upload. Same as `setTestCycleKey`(string), this method must be invoked before all tests;
- `enableRealTimeSync`() - `optional`. Enables real-time results upload. In this mode, result of test execution will be uploaded immediately after test finish. Same as `setTestCycleKey`(string), this method must be invoked before all tests;

By default, results will be uploaded to Zephyr on test launch finish.

```ts
import { test, expect, Page } from '@playwright/test';
const { firefox } = require('playwright');
import { ZebEmitter } from '@zebrunner/javascript-agent-playwright';

test.beforeAll(async () => {
  const tcmRunOptions = [
    {
      zephyrTestCycleKey: 'zephyr123',
      zephyrJiraProjectKey: 'zephyr321',
      zephyrDisableSync: true,
      zephyrEnableRealTimeSync: true,
    }
  ]

  ZebEmitter.addTcmRunOptions(tcmRunOptions);
})

test.describe('nested foo', () => {
  test('test running in Firefox @ff @smoke_test @slow', async ({page}, testInfo) => {
    const tcmTestOptions = [
      {
        zephyrTestCaseKey: ['zephyr', 'zephyr1'],
      },
    ];
    ZebEmitter.addTcmTestOptions(tcmTestOptions);

    const browser = await firefox.launch();
    const page1 = await browser.newPage();
    await page1.goto('https://example.com');
    await browser.close();
  });
};
```
