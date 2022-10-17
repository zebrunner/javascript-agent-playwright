# Zebrunner agent for Playwright testing framework
This agent was originally developed by [Ryan Rosello](https://github.com/ryanrosello-og)
## Setup

Run the following:

`npm i @zebrunner/javascript-agent-playwright -D`

It is currently possible to provide the configuration via:
- `Environment variables`
- `Playwright config`

Environment variables:
- `REPORTING_ENABLED` - `mandatory`, enables or disables reporting. The default value is false. If disabled, the agent will use no op component implementations that will simply log output for tracing purposes with the trace level;
- `REPORTING_SERVER_HOSTNAME` - `mandatory` if reporting is enabled. It is Zebrunner server hostname. It can be obtained in Zebrunner on the 'Account & profile' page under the 'Service URL' section;
- `REPORTING_SERVER_ACCESS_TOKEN` - `mandatory` if reporting is enabled. Access token must be used to perform API calls. It can be obtained in Zebrunner on the 'Account & profile' page under the 'Token' section;

- `REPORTING_PROJECT_KEY` - `optional` value. It is the project that the test run belongs to. The default value is `DEF`. You can manage projects in Zebrunner in the appropriate section;
- `REPORTING_RUN_DISPLAY_NAME` - `optional` value. It is the display name of the test run. The default value is `Default Suite`;
- `REPORTING_RUN_BUILD` - `optional` value. It is the build number that is associated with the test run. It can depict either the test build number or the application build number;
- `REPORTING_RUN_ENVIRONMENT` - `optional` value. It is the environment where the tests will run;
`REPORTING_NOTIFICATION_NOTIFY_ON_EACH_FAILURE` - `optional` value. Specifies whether Zebrunner should send notification to Slack/Teams on each test failure. The notifications will be sent even if the suite is still running. The default value is `false`;
- `REPORTING_NOTIFICATION_SLACK_CHANNELS` - `optional` value. The list of comma-separated Slack channels to send notifications to. Notification will be sent only if Slack integration is properly configured in Zebrunner with valid credentials for the project the tests are reported to. Zebrunner can send two type of notifications: on each test failure (if appropriate property is enabled) and on suite finish;
- `REPORTING_NOTIFICATION_MS_TEAMS_CHANNELS` - `optional` value. The list of comma-separated Microsoft Teams channels to send notifications to. Notification will be sent only if Teams integration is configured in Zebrunner project with valid webhooks for the channels. Zebrunner can send two type of notifications: on each test failure (if appropriate property is enabled) and on suite finish;
- `REPORTING_NOTIFICATION_EMAILS` - `optional` value. The list of comma-separated emails to send notifications to. This type of notification does not require further configuration on Zebrunner side. Unlike other notification mechanisms, Zebrunner can send emails only on suite finish;
- `REPORTING_MILESTONE_ID` - `optional` value. Id of the Zebrunner milestone to link the suite execution to. The id is not displayed on Zebrunner UI, so the field is basically used for internal purposes. If the milestone does not exist, appropriate warning message will be displayed in logs, but the test suite will continue executing;
- `REPORTING_MILESTONE_NAME` - `optional` value. Name of the Zebrunner milestone to link the suite execution to. If the milestone does not exist, appropriate warning message will be displayed in logs, but the test suite will continue executing.
- `PW_CONCURRENT_TASKS` - `optional` value. Special value for `@supercharge/promise-pool` lib. By default `10`;

Playwright config(example):

`playwright.config.ts`
```ts
module.exports = {
  testDir: '<tests directory>',
  reporter: [
    [
      '@zebrunner/javascript-agent-playwright',
      {
        enabled: true,
        reportingServerHostname: 'https://default.zebrunner.com',
        reportingProjectKey: 'DEF',
        reportingRunDisplayName: 'PW-tests',
        reportingRunBuild: 'alpha-1',
        reportingRunEnvironment: 'STAGE',
        reportingNotificationNotifyOnEachFailure: true,
        reportingNotificationSlackChannels: 'channel1,channel2',
        reportingNotificationMsTeamsChannels: 'channel1,channel2',
        reportingNotificationEmails: 'channel1,channel2',
        reportingMilestoneId: '1',
        reportingMilestoneName: 'test',
        pwConcurrentTasks: 19,
      },
    ],
  ],
}
```

Run your tests by providing your Zebrunner `REPORTING_SERVER_ACCESS_TOKEN` as an environment variable:

`REPORTING_SERVER_ACCESS_TOKEN=[your zebrunner api key] npx playwright test`

or add environment variable to `.env` 

`REPORTING_SERVER_ACCESS_TOKEN=<your zebrunner api key>`

and 

`npx playwright test`
# Configuration

It is highly recommended that you enable the screenshot on failure feature, video and trace in your `playwright.config.ts` config file:

```ts
  use: {
    screenshot: 'only-on-failure',
    video: 'on',
    trace: 'on',
  },
```

This will allow the agent to include where possible screenshots of failures, video and trace file in the reports.

Also highly recommended include to `playwright.config.ts` `project` option:

```ts
projects: [
    ...
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    ...
  ],
```

This will help to get information about `browser` and `os` settings.

### Tracking test maintainer

You may want to add transparency to the process of automation maintenance by having an engineer responsible for evolution of specific tests or test classes. Zebrunner comes with a concept of a maintainer - a person that can be assigned to maintain tests.

See a sample test class below:

```ts
import { test, expect, Page } from '@playwright/test';
const { firefox } = require('playwright');
import { ZebEmitter } from '@zebrunner/javascript-agent-playwright';

test.describe('foo - l2 ', () => {
  test.beforeEach(async ({page}) => {
    // Go to the starting url before each test.
    await page.goto('https://playwright.dev/');
  });

  test('my test', async ({page}) => {
    ZebEmitter.setMaintainer('simple');
    // Assertions use the expect API.
    await expect(page).toHaveURL('https://playwright.dev/');
  });

  test('my test1', async ({page}) => {
    ZebEmitter.setMaintainer('emarf');
      
    // Expect a title "to contain" a substring.
    await expect(page).toHaveTitle(/Playwright/);

    // Expect an attribute "to be strictly equal" to the value.
    await expect(page.locator('text=Get Started').first()).toHaveAttribute('href', '/docs/intro');

    // Expect an element "to be visible".
    await expect(page.locator('text=Learn more').first()).toBeVisible();

    await page.click('text=Get Started');
      // Expect some text to be visible on the page.
    await expect(page.locator('text=Introduction').first()).oBeVisible();
  });
}
```

In the example above, `simple` will be reported as a maintainer of `my test`, while `emarf` will be reported as a maintainer of test `my test1`.

The maintainer username should be a valid Zebrunner username, otherwise it will be set to `anonymous`.

### Attaching labels

You can attach labels, by writing them in the name of the test through `@`

Example: 

```ts
test('test runnin in Firery fox @ff @smoke_test @slow', async ({page}, testInfo) => {
    const browser = await firefox.launch();
    const page1 = await browser.newPage();
    await page1.goto('https://example.com');
    await browser.close();
  });
```

After test execution you can see `ff`,`smoke_test`,`slow` on ui.
### Upload test results to external test case management systems

Zebrunner provides an ability to upload test results to external TCMs on test run finish. For some TCMs it is possible to upload results in real-time during the test run execution.

Currently, Zebrunner supports TestRail, Xray, Zephyr Squad and Zephyr Scale test case management systems.

#### Testrail

For successful upload of test run results in TestRail, two steps must be performed:

- Integration with TestRail is configured and enabled for Zebrunner project;
- Configuration is performed on the tests side.


##### Configuration

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
By default, a new run containing only cases assigned to the tests will be created in TestRail on test run finish;

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
  test('test runnin in Firery fox @ff @smoke_test @slow', async ({page}, testInfo) => {
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
#### Xray

For successful upload of test run results in Xray two steps must be performed:

- Xray integration is configured and enabled in Zebrunner project
- Xray configuration is performed on the tests side
##### Configuration

Zebrunner agent has a special Xray class with a bunch of methods to control results upload:

- `setExecutionKey`(string) - `mandatory`. The method sets Xray execution key. This method must be invoked before all tests.
- `setTestKey`(array of string) - `mandatory`. Using these mechanisms you can set test keys associated with specific automated test.
- `disableSync`(boolean) - `optional`. Disables result upload. Same as `setExecutionKey`(string), this method must be invoked before all tests;
- `enableRealTimeSync`(boolean) - `optional`. Enables real-time results upload. In this mode, result of test execution will be uploaded immediately after test finish. Same as `setExecutionKey`(string), this method must be invoked before all tests.

By default, results will be uploaded to Xray on test run finish.

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
  test('test runnin in Firery fox @ff @smoke_test @slow', async ({page}, testInfo) => {
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

#### Zephyr Squad & Zephyr Scale

For successful upload of test run results in Zephyr two steps must be performed:

- Zephyr integration is configured and enabled in Zebrunner project
- Zephyr configuration is performed on the tests side

##### Configuration
- `setTestCycleKey`(string) - `mandatory`. The method sets Zephyr test cycle key. This method must be invoked before all tests;
- `setJiraProjectKey`(string) - `mandatory`. Sets Zephyr Jira project key. Same as `setTestCycleKey`(string), this method must be invoked before all tests;
- `setTestCaseKey`(array of string) - `mandatory`. Using these mechanisms you can set test case keys associated with specific automated test;
- `disableSync`() - `optional`. Disables result upload. Same as `setTestCycleKey`(string), this method must be invoked before all tests;
- `enableRealTimeSync`() - `optional`. Enables real-time results upload. In this mode, result of test execution will be uploaded immediately after test finish. Same as `setTestCycleKey`(string), this method must be invoked before all tests;

By default, results will be uploaded to Zephyr on test run finish.

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
  test('test runnin in Firery fox @ff @smoke_test @slow', async ({page}, testInfo) => {
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
