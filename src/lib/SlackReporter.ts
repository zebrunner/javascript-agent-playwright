import {WebClient, LogLevel} from '@slack/web-api';
import {testResult, testSummary} from './ResultsParser';
import {zebrunnerConfig} from './ZebrunnerReporter';

export default class SlackReporter {
  private _slackClient: WebClient;
  private _channelIds: string[];
  private _enabled: boolean;
  private _notifyOnlyOnFailures: boolean = false;
  private _config: zebrunnerConfig;

  constructor(config: zebrunnerConfig) {
    this._enabled = config.slackEnabled;
    this._config = config;
    if (!this._enabled) {
      console.log('Slack reporter disabled - skipped posting results to Slack');
      return;
    }

    if (!process.env.SLACK_BOT_USER_OAUTH_TOKEN) {
      throw new Error('environment variable: SLACK_BOT_USER_OAUTH_TOKEN  was not supplied');
    }

    if (config.slackReportOnlyOnFailures) {
      this._notifyOnlyOnFailures = true;
    }

    if (!config.slackReportingChannels) {
      throw new Error(
        'No value was set for the "reportingChannels" configuration, this needs a comma separate values to instruct the bot which channel(s) to send the reports'
      );
    } else {
      this._channelIds = config.slackReportingChannels.split(',');
    }

    this._slackClient = new WebClient(process.env.SLACK_BOT_USER_OAUTH_TOKEN, {
      logLevel: LogLevel.DEBUG,
    });
  }

  async getSummaryResults(
    testRunId: number,
    results: testResult[],
    build: string,
    environment: string
  ): Promise<testSummary> {
    const maximumCharLength = this._config.slackStacktraceLength;
    return {
      build,
      environment,
      passed: results.filter((t) => t.status === 'PASSED').length,
      failed: results.filter((t) => t.status === 'FAILED').length,
      skipped: results.filter((t) => t.status === 'SKIPPED').length,
      aborted: results.filter((t) => t.status === 'ABORTED').length,
      duration: this.getTotalRunDuration(results),
      failures: results
        .filter((t) => t.status === 'FAILED')
        .slice(0, this._config.slackDisplayNumberOfFailures)
        .map((failures) => ({
          zebResult: `${this._config.reportingServerHostname}/projects/${this._config.reportingProjectKey}/test-runs/${testRunId}/tests/${failures.testId}`,
          test: failures.name,
          message:
            failures.reason.length > maximumCharLength
              ? failures.reason.substring(0, maximumCharLength).replace(/(\r\n|\n|\r)/gm, '\n>') +
                ' ...'
              : failures.reason.replace(/(\r\n|\n|\r)/gm, '\n>'),
        })),
    };
  }

  getTotalRunDuration(results: testResult[]): number {
    const earliestExecTime = Math.min(...results.map((t) => new Date(t.startedAt).getTime()));
    const latestExecTime = Math.max(...results.map((t) => new Date(t.startedAt).getTime()));
    return Math.ceil((latestExecTime - earliestExecTime) / 1000);
  }

  async sendMessage(summaryResults: testSummary, zeburunnerRunLink: string) {
    if (!this._enabled) {
      console.log('Slack reporter disabled - skipped posting results to Slack');
      return;
    }

    if (this._notifyOnlyOnFailures && summaryResults.failed === 0) {
      console.log('Slack reporter disabled - no failures encountered');
      return;
    }

    // deal with failures
    let fails = [];
    for (const failedTest of summaryResults.failures) {
      fails.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${failedTest.test}* <${failedTest.zebResult}|:information_source:>\n\n>${failedTest.message}`,
        },
      });
    }

    for (const channelId of this._channelIds) {
      try {
        const result = await this._slackClient.chat.postMessage({
          channel: channelId,
          text: ' ',
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `:white_check_mark: *${
                  summaryResults.passed
                }* Tests ran successfully \n\n :red_circle: *${
                  summaryResults.failed
                }* Tests failed \n\n ${
                  summaryResults.skipped > 0
                    ? ':fast_forward: *' + summaryResults.skipped + '* skipped'
                    : ''
                } \n\n ${
                  summaryResults.aborted > 0
                    ? ':exclamation: *' + summaryResults.aborted + '* aborted'
                    : ''
                }`,
              },
              accessory: {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: 'View in Zebrunner',
                  emoji: true,
                },
                value: 'click_me_123',
                url: zeburunnerRunLink,
                action_id: 'button-action',
              },
            },
            {
              type: 'section',
              fields: [
                {
                  type: 'mrkdwn',
                  text: `*Environment:*\n${summaryResults.environment}`,
                },
                {
                  type: 'mrkdwn',
                  text: `*Duration:*\n${summaryResults.duration}`,
                },
                {
                  type: 'mrkdwn',
                  text: `*Build:*\n${summaryResults.build}`,
                },
              ],
            },
            {
              type: 'divider',
            },
            ...fails,
          ],
        });
        console.log(result);
      } catch (error) {
        console.error(error);
      }
    }
  }

  public get isEnabled() {
    return this._enabled;
  }
}
