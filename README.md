# Zebrunner Playwright reporting agent

To learn how to get started and explore available features, please refer to the official Zebrunner Playwright agent [documentation](https://zebrunner.com/documentation/reporting/playwright/) for more information.

## Inclusion into your project

### Adding dependency

First, you need to add the Zebrunner Agent into your `package.json`.

=== "NPM"

    ```shell
    npm install @zebrunner/javascript-agent-playwright
    ```

=== "Yarn"

    ```shell
    yarn add @zebrunner/javascript-agent-playwright
    ```

### Reporter setup

The agent does not work automatically after adding it into the project, it requires extra configuration.
For this, you need to navigate to the Playwright configuration file (by default, it is `playwright.config.ts`) and provide the following information:

- Add `@zebrunner/javascript-agent-playwright` to the list of reporters;
- Provide the reporter configuration (you can find more about the configuration in the [Reporter configuration section](#reporter-configuration) ).

The reporter must be specified in a nested array. The first array element is `@zebrunner/javascript-agent-playwright`, the second element is a reporter configuration object.

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

### Configuration options

The following subsections contain tables with configuration options. The first column in these tables contains the name of the option. It is represented as an environment variable (the first value) and as a reporter config property from `playwright.config.ts` file (the second value). The second column contains description of the configuration option.

#### Common configuration

| Env var / Reporter config                                | Description                                                                                                                                                                      |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `REPORTING_ENABLED`<br/>`enabled`                        | Enables or disables reporting. The default value is `false`. If disabled, agent provides output only to console.                                                                 |
| `REPORTING_PROJECT_KEY`<br/>`projectKey`                 | Optional value. It is the key of Zebrunner project that the launch belongs to. The default value is `DEF`.                                                                       |
| `REPORTING_SERVER_HOSTNAME`<br/>`server.hostname`        | Mandatory if reporting is enabled. It is your Zebrunner hostname, e.g. `https://mycompany.zebrunner.com`.                                                                        |
| `REPORTING_SERVER_ACCESS_TOKEN`<br/>`server.accessToken` | Mandatory if reporting is enabled. The access token is used to perform API calls. It can be obtained in Zebrunner on the 'Account and profile' page in the 'API Access' section. |

#### Automation launch configuration

The following configuration options allow you to configure accompanying information that will be displayed in Zebrunner for the automation launch.

| Env var / Reporter config                                                    | Description                                                                                                                                            |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `REPORTING_LAUNCH_DISPLAY_NAME`<br/>`launch.displayName`                     | Display name of the launch in Zebrunner. The default value is `Default Suite`.                                                                         |
| `REPORTING_LAUNCH_BUILD`<br/>`launch.build`                                  | Build number associated with the launch. It can reflect either the test build number or the build number of the application under test.                |
| `REPORTING_LAUNCH_ENVIRONMENT`<br/>`launch.environment`                      | Represents the target environment in which the tests were run. For example, `stage` or `prod`.                                                         |
| `REPORTING_LAUNCH_TREAT_SKIPS_AS_FAILURES`<br/>`launch.treatSkipsAsFailures` | If the value is set to true, skipped tests will be treated as failures when the result of the entire launch is calculated. For example, launch with all passed tests but one skipped will be considered a failure. The default value is true. |

#### Milestone

Zebrunner Milestone for the automation launch can be configured using the following configuration options (all of them are optional).

| Env var / Reporter config                       | Description                                                                                                                                                                                                                         |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `REPORTING_MILESTONE_ID`<br/>`milestone.id`     | Id of the Zebrunner Milestone to link the automation launch to. The id is not displayed on Zebrunner UI, so the field is basically used for internal purposes. If the milestone does not exist, the launch will continue executing. |
| `REPORTING_MILESTONE_NAME`<br/>`milestone.name` | Name of the Zebrunner Milestone to link the automation launch to. If the milestone does not exist, the appropriate warning message will be displayed in logs, but the test suite will continue executing.                           |

#### Notifications

Zebrunner provides notification capabilities for automation launch results. The following options configure notification rules and targets.

| Env var / Reporter config                                                               | Description                                                                                                                                                                                                                                                                                                                                                              |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `REPORTING_NOTIFICATION_NOTIFY_ON_EACH_FAILURE`<br/>`notifications.notifyOnEachFailure` | Specifies whether Zebrunner should send notifications to Slack/Teams on each test failure. The notifications will be sent even if the launch is still running. The default value is `false`.                                                                                                                                                                             |
| `REPORTING_NOTIFICATION_SLACK_CHANNELS`<br/>`notifications.slackChannels`               | A comma-separated list of Slack channels to send notifications to. Notifications will be sent only if the Slack integration is properly configured in Zebrunner with valid credentials for the project the launch is reported to. Zebrunner can send two types of notifications: on each test failure (if the appropriate property is enabled) and on the launch finish. |
| `REPORTING_NOTIFICATION_MS_TEAMS_CHANNELS`<br/>`notifications.teamsChannels`            | A comma-separated list of Microsoft Teams channels to send notifications to. Notifications will be sent only if the Teams integration is configured in the Zebrunner project with valid webhooks for the channels. Zebrunner can send two types of notifications: on each test failure (if the appropriate property is enabled) and on the launch finish.                |
| `REPORTING_NOTIFICATION_EMAILS`<br/>`notifications.emails`                              | A comma-separated list of emails to send notifications to. This type of notifications does not require further configuration on Zebrunner side. Unlike other notification mechanisms, Zebrunner can send emails only on the launch finish.                                                                                                                               |

#### Integration with Test Case Management systems

Zebrunner integrates with different Test Case Management (TCM) systems and provides the following capabilities:

1. Linking test cases to test executions
2. Previewing linked test cases in Zebrunner
3. Pushing test execution results to the TCM system

This functionality is currently supported only for Zebrunner Test Case Management, TestRail, Xray, Zephyr Squad and Zephyr Scale.

The link between execution of a test method and corresponding test cases can only be set from within the test method code. For more information about this, see the [Linking test cases to test executions](#linking-test-cases-to-test-executions) section.

If you want to push the execution results to the TCM system, you need to provide additional configuration for the Agent. For all the supported TCMs, Zebrunner can push results to a pre-created test suite execution (this term has a different name in different systems). For TestRail, you can also create a new Test Run based on the Agent configuration and push the results into it. If enabled, the push can be performed either at the end of the whole launch, or in real time after each test.

The following subsection covers how to provide configuration for pushing results to each of the TCM systems.

##### Zebrunner Test Case Management (TCM)

| Env var / Reporter config                                                      | Description                                                                                                                                                             |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `REPORTING_TCM_ZEBRUNNER_PUSH_RESULTS`<br/>`tcm.zebrunner.pushResults`         | Boolean value which specifies if the execution results should be pushed to Zebrunner TCM. The default value is `false`.                                                 |
| `REPORTING_TCM_ZEBRUNNER_PUSH_IN_REAL_TIME`<br/>`tcm.zebrunner.pushInRealTime` | Boolean value. Specifies whether to push execution results immediately after each test is finished (value `true`) or not (value `false`). The default value is `false`. |
| `REPORTING_TCM_ZEBRUNNER_TEST_RUN_ID`<br/>`tcm.zebrunner.testRunId`            | Numeric id of the target Test Run in Zebrunner TCM. If a value is not provided, no new runs will be created.                                                            |

##### TestRail

| Env var / Reporter config                                                                      | Description                                                                                                                                                                                                                                            |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `REPORTING_TCM_TESTRAIL_PUSH_RESULTS`<br/>`tcm.testRail.pushResults`                           | Boolean value which specifies if the execution results should be pushed to TestRail. The default value is `false`.                                                                                                                                     |
| `REPORTING_TCM_TESTRAIL_PUSH_IN_REAL_TIME`<br/>`tcm.testRail.pushInRealTime`                   | Boolean value. Specifies whether to push execution results immediately after each test is finished (value `true`) or not (value `false`). The default value is `false`. Enabling of this option forces the `includeAllTestCasesInNewRun` to be `true`. |
| `REPORTING_TCM_TESTRAIL_SUITE_ID`<br/>`tcm.testRail.suiteId`                                   | Specifies the numeric id of the TestRail Suite in which the tests reside. TestRail displays the ids prefixed with 'S' letter. You need to provide the id without this letter.                                                                          |
| `REPORTING_TCM_TESTRAIL_RUN_ID`<br/>`tcm.testRail.runId`                                       | The id of the TestRail Test Run where the results should be pushed. TestRail displays the ids prefixed with 'R' letter. You need to provide the id without this letter.                                                                                |
| `REPORTING_TCM_TESTRAIL_RUN_NAME`<br/>`tcm.testRail.runName`                                   | Specifies the name of a new Test Run in TestRail. If push is enabled and run id is not provided, Zebrunner will create a new run in TestRail. If the value is not provided, Zebrunner will use the launch display name.                                |
| `REPORTING_TCM_TESTRAIL_INCLUDE_ALL_IN_NEW_RUN`<br/>`tcm.testRail.includeAllTestCasesInNewRun` | If the value is set to `true`, all cases from the Suite will be added to the newly created Test Run. The value is forced to be `true` if real-time push is enabled. Default value is `false`.                                                          |
| `REPORTING_TCM_TESTRAIL_MILESTONE_NAME`<br/>`tcm.testRail.milestoneName`                       | The newly created Test Run will be associated with the milestone specified using this property.                                                                                                                                                        |
| `REPORTING_TCM_TESTRAIL_ASSIGNEE`<br/>`tcm.testRail.assignee`                                  | Assignee of the newly created Test Run. The value should be the email of an existing TestRail user.                                                                                                                                                    |

##### Xray

| Env var / Reporter config                                            | Description                                                                                                                                                             |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `REPORTING_TCM_XRAY_PUSH_RESULTS`<br/>`tcm.xray.pushResults`         | Boolean value which specifies if the execution results should be pushed to Xray. The default value is `false`.                                                          |
| `REPORTING_TCM_XRAY_PUSH_IN_REAL_TIME`<br/>`tcm.xray.pushInRealTime` | Boolean value. Specifies whether to push execution results immediately after each test is finished (value `true`) or not (value `false`). The default value is `false`. |
| `REPORTING_TCM_XRAY_EXECUTION_KEY`<br/>`tcm.xray.executionKey`       | The key of the Xray Execution where the results should be pushed.                                                                                                       |

##### Zephyr

| Env var / Reporter config                                                | Description                                                                                                                                                             |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `REPORTING_TCM_ZEPHYR_PUSH_RESULTS`<br/>`tcm.zephyr.pushResults`         | Boolean value which specifies if the execution results should be pushed to Zephyr. The default value is `false`.                                                        |
| `REPORTING_TCM_ZEPHYR_PUSH_IN_REAL_TIME`<br/>`tcm.zephyr.pushInRealTime` | Boolean value. Specifies whether to push execution results immediately after each test is finished (value `true`) or not (value `false`). The default value is `false`. |
| `REPORTING_TCM_ZEPHYR_JIRA_PROJECT_KEY`<br/>`tcm.zephyr.jiraProjectKey`  | Specifies the key of the Jira project where the tests reside.                                                                                                           |
| `REPORTING_TCM_ZEPHYR_TEST_CYCLE_KEY`<br/>`tcm.zephyr.testCycleKey`      | The key of the Zephyr Test Cycle where the results should be pushed.                                                                                                    |

##### Custom Result Statuses

By default, when the execution results are being pushed to a TCM system, Zebrunner maps each test execution result to an appropriate result status in the target TCM system. Most of the time this works perfectly, but in some cases Zebrunner is not able to derive the appropriate target result status.

One of the examples of such cases is when a test case result status does not correlate with the test execution status, or when you have conditional logic determining the actual result status for the test case. For such cases, the Agent comes with a special method which sets a specific Result Status to the test case. For more information about this, see the [Linking test cases to test executions](#linking-test-cases-to-test-executions) section.

Another example is custom Result Statuses in the target TCM system. In this case, we cannot anticipate the correct status and simply skip the test execution. In order to tackle this, Zebrunner allows you to configure default status for passed and failed test executions.

| Env var / Reporter config                                                | Description                                                                                              |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `REPORTING_TCM_TEST_CASE_STATUS_ON_PASS`<br/>`tcm.testCaseStatus.onPass` | The default status that will be assigned to passed test executions when they are pushed to a TCM system. |
| `REPORTING_TCM_TEST_CASE_STATUS_ON_FAIL`<br/>`tcm.testCaseStatus.onFail` | The default status that will be assigned to failed test executions when they are pushed to a TCM system. |

When pushing results to a TCM system, Zebrunner derives the Result Status in the following order:

1. Checks the explicitly assigned value (which was assigned using the `#testCaseStatus()` method).
2. Takes the default status provided via configuration for passed and/or failed tests.
3. Uses internal mapping of Zebrunner statuses to the Result Statuses of the target TCM system.

### Examples

#### Environment Variables

The following code snippet is a list of all configuration environment variables from `.env` file:

```text
   REPORTING_ENABLED=true
   REPORTING_PROJECT_KEY=DEF
   REPORTING_SERVER_HOSTNAME=https://mycompany.zebrunner.com
   REPORTING_SERVER_ACCESS_TOKEN=somesecretaccesstoken

   REPORTING_LAUNCH_DISPLAY_NAME=Nightly Regression
   REPORTING_LAUNCH_BUILD=2.41.2.2431-SNAPSHOT
   REPORTING_LAUNCH_ENVIRONMENT=QA
   REPORTING_LAUNCH_TREAT_SKIPS_AS_FAILURES=TRUE

   REPORTING_MILESTONE_ID=1
   REPORTING_MILESTONE_NAME=Release 1.0.0

   REPORTING_NOTIFICATION_NOTIFY_ON_EACH_FAILURE=false
   REPORTING_NOTIFICATION_SLACK_CHANNELS=dev,qa
   REPORTING_NOTIFICATION_MS_TEAMS_CHANNELS=dev-channel,management
   REPORTING_NOTIFICATION_EMAILS=manager@mycompany.com

   REPORTING_TCM_TEST_CASE_STATUS_ON_PASS=PASS
   REPORTING_TCM_TEST_CASE_STATUS_ON_FAIL=FAIL

   REPORTING_TCM_ZEBRUNNER_PUSH_RESULTS=false
   REPORTING_TCM_ZEBRUNNER_PUSH_IN_REAL_TIME=true
   REPORTING_TCM_ZEBRUNNER_TEST_RUN_ID=42

   REPORTING_TCM_TESTRAIL_PUSH_RESULTS=false
   REPORTING_TCM_TESTRAIL_PUSH_IN_REAL_TIME=true
   REPORTING_TCM_TESTRAIL_SUITE_ID=100
   REPORTING_TCM_TESTRAIL_RUN_ID=500
   REPORTING_TCM_TESTRAIL_INCLUDE_ALL_IN_NEW_RUN=true
   REPORTING_TCM_TESTRAIL_RUN_NAME=New Demo Run
   REPORTING_TCM_TESTRAIL_MILESTONE_NAME=Demo Milestone
   REPORTING_TCM_TESTRAIL_ASSIGNEE=tester@mycompany.com

   REPORTING_TCM_XRAY_PUSH_RESULTS=false
   REPORTING_TCM_XRAY_PUSH_IN_REAL_TIME=true
   REPORTING_TCM_XRAY_EXECUTION_KEY=QT-100

   REPORTING_TCM_ZEPHYR_PUSH_RESULTS=false
   REPORTING_TCM_ZEPHYR_PUSH_IN_REAL_TIME=true
   REPORTING_TCM_ZEPHYR_JIRA_PROJECT_KEY=ZEB
   REPORTING_TCM_ZEPHYR_TEST_CYCLE_KEY=ZEB-T1
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
        projectKey: 'DEF',
        server: {
          hostname: 'https://mycompany.zebrunner.com',
          accessToken: 'somesecretaccesstoken',
        },
        launch: {
          displayName: 'Playwright launch',
          build: '1.0.0',
          environment: 'Local',
        },
        milestone: {
          id: null,
          name: null,
        },
        notifications: {
          notifyOnEachFailure: false,
          slackChannels: 'dev, qa',
          teamsChannels: 'dev-channel, management',
          emails: 'dkazak@zebrunner.com',
        },
        tcm: {
          testCaseStatus: {
            onPass: 'SUCCESS',
            onFail: 'FAILED',
          },
          zebrunner: {
            pushResults: false,
            pushInRealTime: false,
            testRunId: 42,
          },
          testRail: {
            pushResults: false,
            pushInRealTime: false,
            suiteId: 100,
            runId: 500,
            includeAllTestCasesInNewRun: true,
            runName: 'New Demo Run',
            milestoneName: 'Demo Milestone',
            assignee: 'tester@mycompany.com',
          },
          xray: {
            pushResults: false,
            pushInRealTime: false,
            executionKey: 'QT-100',
          },
          zephyr: {
            pushResults: false,
            pushInRealTime: false,
            jiraProjectKey: 'ZEB',
            testCycleKey: 'ZEB-T1',
          },
        },
      },
    ],
  ],
});
```

## Collecting screenshots

It is highly recommended to add following additional configuration to your `playwright.config.ts` config file:

- enable taking screenshots on failure feature that will allow to send them into Zebrunner:

```ts title="playwright.config.ts"
use: {
  screenshot: 'only-on-failure';
}
```

[//]: # 'FIXME: when video/trace is on, launch is hang up, necessary to fix'
[//]: # '- enable capturing of a video and trace - will be attached as artifacts'
[//]: #
[//]: # '```ts title="playwright.config.ts"'
[//]: # '  use: {'
[//]: # "    screenshot: 'only-on-failure',"
[//]: # "    video: 'on',"
[//]: # "    trace: 'on',"
[//]: # '  },'
[//]: # '```'

- enable detection of `browser` and `os` settings that will be sent to Zebrunner:

```ts title="playwright.config.ts"
projects: [
    ...
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] }
    },
    ...
]
```

You may want to create screenshots manually during test execution. In this case you need to attach each manually created screenshot to test using Playwright `testInfo.attach()` method. After attaching screenshot, it will be uploaded to Zebrunner automatically.

```ts
test.describe('Test suite', () => {
  test('some test name', async ({ page }, testInfo) => {
    // ...
    const screenshot = await page.screenshot();
    await testInfo.attach('manualScreenshot.png', { body: screenshot, contentType: 'image/png' });
    // ...
  });
});
```

## Tracking test maintainer

You may want to add transparency to the process of automation maintenance by having an engineer responsible for evolution of specific tests or test suites. To serve that purpose, Zebrunner comes with a concept of a maintainer.

In order to keep track of those, the Agent comes with the `#setMaintainer()` method of the `CurrentTest` object. This method accepts the username of an existing Zebrunner user. If there is no user with the given username, `anonymous` will be assigned.

```ts
import { CurrentTest } from '@zebrunner/javascript-agent-playwright';

test.describe('Test suite', () => {
  test('first test', async ({ page }) => {
    CurrentTest.setMaintainer('developer');
    // ...
  });

  test('second test', async ({ page }) => {
    CurrentTest.setMaintainer('tester');
    // ...
  });
});
```

In this example, `developer` will be reported as a maintainer of `first test` , while `tester` will be reported as a maintainer of the `second test`.

## Attaching labels

In some cases, it may be useful to attach meta information related to a test. The agent comes with a concept of labels. Label is a simple key-value pair.

### Attaching label to test using test name

You can attach labels by writing them in the name of the test through `@`:

```ts
test('test running in Firefox @ff @smoke_test @slow', async ({ page }, testInfo) => {
  const browser = await firefox.launch();
  const page1 = await browser.newPage();
  await page1.goto('https://example.com');
  await browser.close();
});
```

After test execution, labels with `tag` key and `ff`, `smoke_test`, `slow` values will be added to the specific test.

### Attaching label to test or entire run using attachLabel agent method

To attach a label to a test, you need to invoke the `attachLabel` method of the `CurrentTest` object in scope of the test method. To attach label to the entire launch, you can either invoke the `attachLabel` method of the `CurrentLaunch` object.

The `#attachLabel()` method accepts the `key` as first argument and `values` starting from the second argument.

```ts
import { CurrentTest, CurrentLaunch } from '@zebrunner/javascript-agent-playwright';

test.describe('Test suite', () => {
  test.beforeAll(async () => {
    // will be attached to the entire run
    CurrentLaunch.attachLabel('label', 'value');
  });

  test('first test', async ({ page }) => {
    CurrentTest.attachLabel('tag', 'ff');
    // ...
  });

  test('second test', async ({ page }) => {
    CurrentTest.attachLabel('customLabelName', 'smoke_test', 'slow');
    // ...
  });
});
```

#### In this example:

Label with `label` key and `value` value will be added to entire run.

Label with `tag` key and `ff` value will be added to `first test`.

Labels with `customLabelName` key, `smoke_test` and `slow` values will be added to `second test`.

## Adding custom log to test

You may want to add custom test logs displayed in Zebrunner.

The Agent comes with the `#addLog()` method of the `CurrentTest` object. This method accepts the `message` as argument and should be used in the scope of the test method.

```ts
import { CurrentTest } from '@zebrunner/javascript-agent-playwright';

test.describe('Test suite', () => {
  test('first test', async ({ page }) => {
    CurrentTest.addLog('custom log message on test start');
    // ...
  });
});
```

In this example, log with `custom log message on test start` message will be applied to `first test` and visible in `Zebrunner` along with other logs collected by Playwright.

## Attaching artifact references to test and launch

Labels are not the only option for attaching meta information to test and launch. If the information you want to attach is a link (to a file or webpage), it is more useful to attach it as an artifact reference (or to put it simply as a link).

The `attachArtifactReference` methods of the `CurrentTest` and `CurrentLaunch` objects serve exactly this purpose. These methods accept two arguments. The first one is the artifact reference name which will be shown in Zebrunner. The second one is the artifact reference value.

```ts
import { CurrentTest, CurrentLaunch } from '@zebrunner/javascript-agent-playwright';

test.describe('Test Suite', () => {
  test.beforeAll(async () => {
    // will be attached to the entire run
    CurrentLaunch.attachArtifactReference('Zebrunner', 'https://zebrunner.com');
  });

  test('first test', async ({ page }) => {
    // will be attached to 'important test' only
    CurrentTest.attachArtifactReference('SUT', 'https://myapp.com/app');
    // ...
  });
});
```

## Attaching artifacts to test and launch

In case your tests or the entire launch produce some artifacts, it may be useful to track them in Zebrunner. The agent comes with convenient methods for uploading artifacts in Zebrunner and linking them to the currently running test or the launch.

The `attachArtifact` method of the `CurrentTest` and `CurrentLaunch` objects serve exactly this purpose. This method accept two arguments. The first one is the artifact `path` on disk or `Buffer` instance. The second one is the artifact `name` which will be shown in Zebrunner. The `name` is optional.

```ts
import * as fs from 'fs';
import { CurrentTest, CurrentLaunch } from '@zebrunner/javascript-agent-playwright';

test.describe('Test Suite', () => {
  test.beforeAll(async () => {
    // will be attached to the entire run and named "some_text_file1.txt"
    CurrentLaunch.attachArtifact('./some_folder/some_text_file1.txt');
    // ...

    // will be attached to the entire run and named "text1.txt"
    CurrentLaunch.attachArtifact('./some_folder/some_text_file1.txt', 'text1.txt');
    // ...
  });

  test('first test', async ({ page }) => {
    // will be attached to 'first test' only and named "some_text_file1.txt"
    CurrentTest.attachArtifact('./some_folder/some_text_file1.txt');
    // ...

    // will be attached to 'first test' only and named "custom_log.txt"
    const bufferFileOne = fs.readFileSync('./my_project/custom_log.txt');
    CurrentTest.attachArtifact(bufferFileOne, 'custom_log.txt');
    // ...

    // will be attached to 'first test' only and named "file_{someISODate}"
    const bufferFileTwo = fs.readFileSync('./my_project/custom_log.txt');
    CurrentTest.attachArtifact(bufferFileTwo);
    // ...
  });
});
```

## Reverting test registration

In some cases, it might be handy not to register test executions in Zebrunner. This may be caused by very special circumstances of a test environment or execution conditions.

Zebrunner Agent comes with a convenient method `#revertRegistration()` of the `CurrentTest` object for reverting test registration at runtime. The following code snippet shows a case where test is not reported on Monday.

```ts
import { CurrentTest } from '@zebrunner/javascript-agent-playwright';

test.describe('Test Suite', () => {
  test('not important test', async ({ page }) => {
    if (new Date().getDay() === 1) {
      currentTest.revertRegistration();
    }
    // test code
  });
});
```

It is worth mentioning that the method invocation does not affect the test execution, but simply unregisters the test in Zebrunner instead of finishing it. To interrupt the test execution, you need to do additional actions, for example, throw an Error.

## Linking test cases to test executions

Note: to learn more about pushing results to a TCM system, see the [Integration with Test Case Management systems](#integration-with-test-case-management-systems) section.

### Zebrunner TCM

The Agent comes with the `zebrunner` object which contains methods to link test cases to a currently executing test:

- `#testCaseKey(...testCaseKeys)` — accepts a list of test cases which should be linked to the current test;
- `#testCaseStatus(testCaseKey, resultStatus)` — links one test case and provides\overrides its result status. This may be useful if the test case result status does not correlate with the test execution status or if you have conditional logic determining the actual result status for the test case.

If these methods are invoked for the same test case id many times within a test method, the last invocation will take precedence. For example, if you invoke the `#testCaseStatus('KEY-1', 'SKIPPED')` first, and then invoke the `#testCaseKey('KEY-1')`, then the result status you provided in the first invocation will be ignored.

Here is an example:

```js
import { zebrunner } from '@zebrunner/javascript-agent-playwright';

describe('Test Suite', () => {
  it('first test', () => {
    // links single test case 'KEY-1000' to the test
    zebrunner.testCaseKey('KEY-1000');
    // test code
  });

  it('second test', () => {
    // links test cases 'KEY-2000' and 'KEY-2001' to the current test
    zebrunner.testCaseKey('KEY-2000', 'KEY-2001');
    // test code
  });

  it('third test', () => {
    // links test case 'KEY-3000' to the current test
    zebrunner.testCaseKey('KEY-3000');
    // test code
    if (someCondition) {
      // overriddes the status of the test case when results are pushed to the Zebrunner TCM.
      // using this method, you can manually specify the desired result status.
      zebrunner.testCaseStatus('KEY-3000', 'SKIPPED');
    }
  });
});
```

### TestRail

The Agent comes with the `testRail` object which contains methods to link test cases to a currently executing test:

- `#testCaseId(...testCaseIds)` — accepts a list of test cases which should be linked to current test;
- `#testCaseStatus(testCaseId, resultStatus)` — links one test case and provides\overrides its result status. This may be useful if the test case result status does not correlate with the test execution status, or if you have conditional logic determining the actual result status for the test case.

If these methods are invoked for the same test case id many times within a test method, the last invocation will take precedence. For example, if you invoke the `#testCaseStatus('C1', 'SKIPPED')` first and then invoke the `#testCaseId('C1')`, then the result status you provided in the first invocation will be ignored.

Here is an example:

```js
import { testRail } from '@zebrunner/javascript-agent-playwright';

describe('Test Suite', () => {
  it('first test', () => {
    // links single test case 'C1002' to the test
    testRail.testCaseId('C1000');
    // test code
  });

  it('second test', () => {
    // links test cases 'C2000' and 'C2001' to the current test
    testRail.testCaseId('C2000', 'C2001');
    // test code
  });

  it('third test', () => {
    // links test case 'C3000' to the current test
    testRail.testCaseId('C3000');
    // test code
    if (someCondition) {
      // overriddes the status of the test case when results are pushed to the TestRail.
      // by default Zebrunner maps the test execution result to a result status from TestRail.
      // using this method, you can manually specify the desired result status.
      testRail.testCaseStatus('C3000', 'SKIPPED');
    }
  });
});
```

### Xray

The Agent comes with the `xray` object which contains methods to link test cases to a currently executing test:

- `#testCaseKey(...testCaseKeys)` — accepts a list of test cases which should be linked to current test;
- `#testCaseStatus(testCaseKey, resultStatus)` — links one test case and provides\overrides its result status. This may be useful if the test case result status does not correlate with the test execution status, or if you have conditional logic determining the actual result status for the test case.

If these methods are invoked for the same test case id many times within a test method, the last invocation will take precedence. For example, if you invoke the `#testCaseStatus('KEY-1', 'SKIP')` first, and then invoke the `#testCaseKey('KEY-1')`, then the result status you provided in the first invocation will be ignored.

Here is an example:

```js
import { xray } from '@zebrunner/javascript-agent-playwright';

describe('Test Suite', () => {
  it('first test', () => {
    // links single test case 'KEY-1000' to the test
    xray.testCaseKey('KEY-1000');
    // test code
  });

  it('second test', () => {
    // links test cases 'KEY-2000' and 'KEY-2001' to the current test
    xray.testCaseKey('KEY-2000', 'KEY-2001');
    // test code
  });

  it('third test', () => {
    // links test case 'KEY-3000' to the current test
    xray.testCaseKey('KEY-3000');
    // test code
    if (someCondition) {
      // overriddes the status of the test case when results are pushed to the Xray.
      // by default Zebrunner maps the test execution result to a result status from Xray.
      // using this method, you can manually specify the desired result status.
      xray.testCaseStatus('KEY-3000', 'SKIP');
    }
  });
});
```

### Zephyr

The Agent comes with the `zephyr` object which contains methods to link test cases to a currently executing test:

- `#testCaseKey(...testCaseKeys)` — accepts a list of test cases which should be linked to current test;
- `#testCaseStatus(testCaseKey, resultStatus)` — links one test case and provides\overrides its result status. This may be useful if the test case result status does not correlate with the test execution status, or if you have conditional logic determining the actual result status for the test case.

If these methods are invoked for the same test case id many times within a test method, the last invocation will take precedence. For example, if you invoke the `#testCaseStatus('KEY-1', 'SKIP')` first, and then invoke the `#testCaseKey('KEY-1')`, then the result status you provided in the first invocation will be ignored.

Here is an example:

```js
import { zephyr } from '@zebrunner/javascript-agent-playwright';

describe('Test Suite', () => {
  it('first test', () => {
    // links single test case 'KEY-1000' to the test
    zephyr.testCaseKey('KEY-1000');
    // test code
  });

  it('second test', () => {
    // links test cases 'KEY-2000' and 'KEY-2001' to the current test
    zephyr.testCaseKey('KEY-2000', 'KEY-2001');
    // test code
  });

  it('third test', () => {
    // links test case 'KEY-3000' to the current test
    zephyr.testCaseKey('KEY-3000');
    // test code
    if (someCondition) {
      // overriddes the status of the test case when results are pushed to the Zephyr.
      // by default Zebrunner maps the test execution result to a result status from Zephyr.
      // using this method, you can manually specify the desired result status.
      zephyr.testCaseStatus('KEY-3000', 'SKIP');
    }
  });
});
```

## Contribution

To check out the project and build from the source, do the following:

```
git clone https://github.com/zebrunner/javascript-agent-playwright.git
cd javascript-agent-playwright
```

## License

Zebrunner reporting agent for Playwright is released under version 2.0 of the [Apache License](https://www.apache.org/licenses/LICENSE-2.0).
