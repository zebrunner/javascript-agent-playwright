<!-- # pw-zeb ![Biulds](https://github.com/ryanrosello-og/zebrunner-playwright-agent/actions/workflows/main.yml/badge.svg) [![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/ryanrosello-og/zebrunner-playwright-agent/blob/master/LICENSE)

> Publish [Playwright](https://playwright.dev/) test results directly to [Zebrunner](https://zebrunner.com/) after the completion of all test suite execution. -->

# Setup

Run the following:

`yarn add zebrunner-playwright-agent -D`

It is currently possible to provide the configuration via:
- Environment variables
- Playwright config

Environment variables:
- `REPORTING_ENABLED` - `mandatory`, enables or disables reporting. The default value is false. If disabled, the agent will use no op component implementations that will simply log output for tracing purposes with the trace level;
- `REPORTING_SERVER_HOSTNAME` - `mandatory` if reporting is enabled. It is Zebrunner server hostname. It can be obtained in Zebrunner on the 'Account & profile' page under the 'Service URL' section;
- `REPORTING_SERVER_ACCESS_TOKEN` - `mandatory` if reporting is enabled. Access token must be used to perform API calls. It can be obtained in Zebrunner on the 'Account & profile' page under the 'Token' section;
- `REPORTING_PROJECT_KEY` - `optional` value. It is the project that the test run belongs to. The default value is DEF. You can manage projects in Zebrunner in the appropriate section;
REPORTING_RUN_DISPLAY_NAME - optional value. It is the display name of the test run. The default value is Default Suite;
REPORTING_RUN_BUILD - optional value. It is the build number that is associated with the test run. It can depict either the test build number or the application build number;
REPORTING_RUN_ENVIRONMENT - optional value. It is the environment where the tests will run;
REPORTING_RUN_RETRY_KNOWN_ISSUES - optional value. If set to false and test failed with an issue previously occurred for the test method, then the agent will ignore results of the IRetryAnalyzer assigned to test and stop retries. The default value is true;
REPORTING_NOTIFICATION_NOTIFY_ON_EACH_FAILURE - optional value. Specifies whether Zebrunner should send notification to Slack/Teams on each test failure. The notifications will be sent even if the suite is still running. The default value is false;
REPORTING_NOTIFICATION_SLACK_CHANNELS - optional value. The list of comma-separated Slack channels to send notifications to. Notification will be sent only if Slack integration is properly configured in Zebrunner with valid credentials for the project the tests are reported to. Zebrunner can send two type of notifications: on each test failure (if appropriate property is enabled) and on suite finish;
REPORTING_NOTIFICATION_MS_TEAMS_CHANNELS - optional value. The list of comma-separated Microsoft Teams channels to send notifications to. Notification will be sent only if Teams integration is configured in Zebrunner project with valid webhooks for the channels. Zebrunner can send two type of notifications: on each test failure (if appropriate property is enabled) and on suite finish;
REPORTING_NOTIFICATION_EMAILS - optional value. The list of comma-separated emails to send notifications to. This type of notification does not require further configuration on Zebrunner side. Unlike other notification mechanisms, Zebrunner can send emails only on suite finish;
REPORTING_MILESTONE_ID - optional value. Id of the Zebrunner milestone to link the suite execution to. The id is not displayed on Zebrunner UI, so the field is basically used for internal purposes. If the milestone does not exist, appropriate warning message will be displayed in logs, but the test suite will continue executing;
REPORTING_MILESTONE_NAME - optional value. Name of the Zebrunner milestone to link the suite execution to. If the milestone does not exist, appropriate warning message will be displayed in logs, but the test suite will continue executing.

```
  reporter: [
    [
      './node_modules/zebrunner-playwright-agent/src/build/src/lib/zebReporter.js',
      {
        enabled: true,
        reportingServerHostname: 'https://default.zebrunner.com',
        reportingProjectKey: 'DEF',
        reportingRunDisplayName: 'PW-tests',
        reportingRunBuild: 'alpha-1',
        reportingRunEnvironment: 'STAGE',
        reportingNotificationSlackChannels: 'channel1,channel2',
        reportingNotificationMsTeamsChannels: 'channel1,channel2',
        reportingNotificationEmails: 'channel1,channel2',
        reportingMilestoneId: '1',
        reportingMilestoneName: 'test',
        pwConcurrentTasks: 19,
      },
    ],
  ],
```




Run your tests by providing your Zebrunner API_KEY as an environment variable:

`ZEB_API_KEY=[your zebrunner api key] npx playwright test`

# Configuration

It is highly recommended that you enable the screenshot on failure feature in your `playwright.config.ts` config file:

```
  use: {
    ...
    screenshot: 'only-on-failure',
    ...
  },
```

This will allow the agent to include screenshots of failures in the reports.

Optionally, you can define an additional Environment variable in the CLI

* BUILD_INFO - test suites will be tagged with the provided comma separated values 
* TEST_ENVIRONMENT - which environment the tests ran against e.g. STG or PROD

The example below will classify the `smoke_tests` as having run in the `dev` environment against the CI build number `559340345`

`ZEB_API_KEY=[your zebrunner api key] BUILD_INFO=559340345,smoke_tests TEST_ENVIRONMENT=dev npx playwright test`

You can further customize the reporter by overriding these values:

| Config          | Default | Description                                                                                                                                                                                 |   |
|-----------------|---------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|---|
| enabled         | true    | When this key is set to false, the agent will not post results to Zebrunner.                                                                                                                |   |
| concurrentTasks | 10      | Instructs the reporter on how many concurrent requests will be made to Zebrunner in order to speed up the posting of the results.  The maximum allowable number of parallel requests is 20. |   |
| reporterBaseUrl |         | The base url for your Zebrunner instance                                                                                                                                                    |   |
| projectKey      |         | The Zebrunner project key.  e.g. DEF                                                                                                                                                        |   |

# Slack Notification

To enable Slack notification, you must firstly generate OAuth token for you bot.  Use the existing **[Slack configuration documentation](https://zebrunner.com/documentation/integrations/slack#configuration)** provided by Zebrunner to obtain the token.

Once the OAuth token is generated, you can then provide this value as an environment variable when invoking your tests via the CLI:

e.g.

`ZEB_API_KEY=YOUR_ZEBRUNNER_KEY SLACK_BOT_USER_OAUTH_TOKEN=xoxb-28794-YOUR_BOT_TOKEN npx playwright test`

There are other configurable items available in order to customize the results posted into Slack

**slackEnabled** <default: true> - when true, the reporter will post the test summary to the desired Slack channels

**slackDisplayNumberOfFailures**: <default: 10> -  How many failed tests will be show in the Slack message

**slackReportOnlyOnFailures**: <default: true> - Slack message will only be posted if at least 1 failed test exists

**slackReportingChannels**: e.g.'zeb,general' - comma separated values denoting the channel(s) where the test summary will be posted to

**slackStacktraceLength**: <default: 270> - the maximum number of characters from the stack trace to be included in the summary for each failed test

The snippet below shows a typical configuration of the reporter:

```
  reporter: [
    [
      './node_modules/zebrunner-playwright-agent/src/build/src/lib/zebReporter.js',
      {
        reporterBaseUrl: 'https://default.zebrunner.com',
        projectKey: 'DEF',
        enabled: true,
        concurrentTasks: 19,
        slackEnabled: true,
        slackDisplayNumberOfFailures: 10,
        slackReportOnlyOnFailures: true,
        slackReportingChannels: 'zeb,general',
        slackStacktraceLength: 270,
      },
    ],
  ],
```

The example above will send the test summary results to both the `#zeb` and `#general` channels.  It will only post results if more than 1 failed test is encountered.  Only the first 10 failures will be sent and the length of the stack trace will be limited to 270 characters.

After successful configuration, you should now see results posted to Slack similar to the image below:

![Slack - successful configuration](https://github.com/ryanrosello-og/zebrunner-playwright-agent/blob/main/assets/slack.png?raw=true)


# Contribution

# License
