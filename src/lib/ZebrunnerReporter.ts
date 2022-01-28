// playwright.config.ts
import {FullConfig, Reporter, Suite} from '@playwright/test/reporter';
import {PromisePool} from '@supercharge/promise-pool';
import ZebAgent from './ZebAgent';
import ResultsParser, {testResult, testRun} from './ResultsParser';
import {tcmEvents} from './constants';
import {parseNotifications, parsePwConfig, parseTcmRunOptions, parseTcmTestOptions} from './utils';
// import SlackReporter from './SlackReporter';

export type zebrunnerConfig = {
  enabled: boolean;
  reportingServerHostname: string;
  reportingProjectKey?: string;
  reportingRunDisplayName?: string;
  reportingRunBuild?: string;
  reportingRunEnvironment?: string;
  reportingNotifyOnEachFailure: boolean;
  reportingNotificationSlackChannels?: string;
  reportingNotificationMsTeamsChannels?: string;
  reportingNotificationEmails?: string;
  reportingMilestoneId?: string;
  reportingMilestoneName?: string;
  pwConcurrentTasks?: number;
  slackEnabled?: boolean;
  slackReportOnlyOnFailures?: boolean;
  slackDisplayNumberOfFailures?: number;
  slackReportingChannels?: string;
  slackStacktraceLength?: number;
};
export type RerunConfig = {
  rerunOnlyFailedTests: boolean;
  mode: string;
  runAllowed: boolean;
  reason: string;
  runOnlySpecificTests: boolean;
  testsToRun:
    | {
        id: number;
        name: string;
        correlationData: string;
        status: string;
        startedAt: string;
        endedAt: string;
      }[]
    | [];
  runExists: boolean;
  id: string;
  testRunUuid: string;
};
class ZebrunnerReporter implements Reporter {
  private suite!: Suite;
  private zebConfig: zebrunnerConfig;
  private zebAgent: ZebAgent;
  // private slackReporter: SlackReporter;
  private testRunId: number;
  private tcmConfig: {};
  private rerunConfig: RerunConfig;

  async onBegin(config: FullConfig, suite: Suite) {
    this.zebConfig = parsePwConfig(config);
    this.suite = suite;
    this.zebAgent = new ZebAgent(this.zebConfig);
    await this.zebAgent.initialize();
    this.suite = await this.rerunResolver(suite);
  }

  async rerunResolver(suite: Suite) {
    try {
      if (!process.env.REPORTING_RUN_CONTEXT) {
        return suite;
      }

      const response = await this.zebAgent.rerunRequest(
        JSON.parse(process.env.REPORTING_RUN_CONTEXT)
      );
      console.log(response.data);
      this.rerunConfig = response.data;
      if (this.rerunConfig.mode === 'NEW' || !this.rerunConfig.runOnlySpecificTests) {
        return suite;
      }

      if (!this.rerunConfig.runAllowed) {
        throw new Error(`${this.rerunConfig.reason}`);
      }

      const recursiveTestsTraversal = (suite) => {
        for (const res of suite.suites) {
          if (res.tests.length > 0) {
            const suiteName = res.parent.title ? `${res.parent.title} > ${res.title}` : res.title;
            res.tests = res.tests.filter((el) => {
              const testName = `${suiteName} > ${el.title}`;
              if (
                this.rerunConfig.testsToRun.some(
                  (item: {
                    id: number;
                    name: string;
                    correlationData: string;
                    status: string;
                    startedAt: string;
                    endedAt: string;
                  }) => item.name === testName
                )
              ) {
                return true;
              }
              return false;
            });
          }
          recursiveTestsTraversal(res);
        }
      };
      recursiveTestsTraversal(suite);

      return suite;
    } catch (error) {
      console.log(error);
    }
  }

  onStdOut(chunk, test, result) {
    if (chunk.includes('connect') || chunk.includes('POST')) {
      return;
    }
    const {type, data} = JSON.parse(chunk);
    if (type === tcmEvents.TCM_RUN_OPTIONS) {
      this.tcmConfig = parseTcmRunOptions(data);
    }

    if (type === tcmEvents.TCM_TEST_OPTIONS) {
      const parseTestTcmOptions = parseTcmTestOptions(data, this.tcmConfig);
      test.tcmTestOptions = parseTestTcmOptions;
    }

    if (type === tcmEvents.SET_MAINTAINER) {
      test.maintainer = data;
    }
  }

  async onEnd() {
    try {
      if (!this.zebAgent.isEnabled) {
        console.log('Zebrunner agent disabled - skipped results upload');
        return;
      }

      let resultsParser = new ResultsParser(this.suite, this.zebConfig, this.rerunConfig);
      await resultsParser.parse();
      let parsedResults = await resultsParser.getParsedResults();
      console.time('Duration');
      let zebrunnerResults = await this.postResultsToZebRunner(
        resultsParser.getRunStartTime(),
        parsedResults
      );

      // const slackResults = zebrunnerResults.testsExecutions.results;
      delete zebrunnerResults.testsExecutions.results; // omit results from printing
      console.log(zebrunnerResults);
      console.log(
        zebrunnerResults.resultsLink !== ''
          ? `View in Zebrunner => ${zebrunnerResults.resultsLink}`
          : ''
      );
      console.timeEnd('Duration');

      // post to Slack (if enabled)
      // this.slackReporter = new SlackReporter(this.zebConfig);
      // if (this.slackReporter.isEnabled) {
      //   let testSummary = await this.slackReporter.getSummaryResults(
      //     this.testRunId,
      //     slackResults,
      //     resultsParser.build,
      //     resultsParser.environment
      //   );
      //   await this.slackReporter.sendMessage(testSummary, zebrunnerResults.resultsLink);
      // }
    } catch (error) {
      console.log('onEnd', error);
    }
  }

  async postResultsToZebRunner(runStartTime: number, testResults: testRun) {
    try {
      let testRunName = testResults.testRunName;

      await this.startTestRuns(runStartTime, testRunName);

      console.log('testRuns >>', this.testRunId);

      const runTags = this.createRunTags();
      let testRunTags = await this.addTestRunTags(this.testRunId, runTags);

      let testsExecutions;
      if (this.rerunConfig) {
        if (this.rerunConfig.mode === 'RERUN') {
          testsExecutions = await this.startRerunTestExecutions(this.testRunId, testResults.tests);
        } else {
          testsExecutions = await this.startTestExecutions(this.testRunId, testResults.tests);
        }
      } else {
        testsExecutions = await this.startTestExecutions(this.testRunId, testResults.tests);
      }
      let testTags = await this.addTestTags(this.testRunId, testsExecutions.results);
      let screenshots = await this.addScreenshots(this.testRunId, testsExecutions.results);
      let testArtifacts = await this.addTestArtifacts(this.testRunId, testsExecutions.results);
      let testSteps = await this.sendTestSteps(this.testRunId, testsExecutions.results);
      let endTestExecutions = await this.finishTestExecutions(
        this.testRunId,
        testsExecutions.results
      );

      let testSessions = await this.sendTestSessions(
        this.testRunId,
        runStartTime,
        testsExecutions.results
      );

      let videoArtifacts = await this.addVideoArtifacts(
        this.testRunId,
        testSessions.sessionsWithVideoAttachments,
        testsExecutions.results
      );
      let stopTestRunsResult = await this.stopTestRuns(this.testRunId, new Date().toISOString());

      let summary = {
        testsExecutions: {
          success: testsExecutions.results.length,
          errors: testsExecutions.errors.length,
          results: testsExecutions.results,
        },
        testRunTags: {
          success: testRunTags && testRunTags.status === 204 ? 1 : 0,
          errors: testRunTags && testRunTags.status !== 204 ? 1 : 0,
          isEmpty: !testRunTags ? true : false,
        },
        testTags: {
          success: testTags.results.filter((f) => f && f.status === 204).length,
          errors: testTags.errors.length,
        },
        screenshots: {
          success: screenshots.results.filter((f) => f && f.status === 201).length,
          errors: screenshots.errors.length,
        },
        testArtifacts: {
          success: testArtifacts.results.filter((f) => f && f.status === 201).length,
          errors: testArtifacts.errors.length,
        },
        videoArtifacts: {
          success: videoArtifacts.results.filter((f) => f && f.status === 201).length,
          errors: videoArtifacts.errors.length,
        },
        testStepsRequests: {
          success: testSteps.status === 202 ? 1 : 0,
          errors: testSteps.status !== 202 ? 1 : 0,
        },
        endTestExecutions: {
          success: endTestExecutions.results.filter((f) => f && f.status === 200).length,
          errors: endTestExecutions.errors.length,
        },
        testSessions: {
          success: testSessions.results.filter((f) => f && f.status === 200).length,
          errors: testSessions.errors.length,
        },
        stopTestRunsResult: {
          success: stopTestRunsResult.status === 200 ? 1 : 0,
          errors: stopTestRunsResult.status !== 200 ? 1 : 0,
        },
        resultsLink: this.testRunId
          ? `${this.zebAgent.baseUrl}/projects/${this.zebAgent.projectKey}/test-runs/${this.testRunId}`
          : '',
      };
      return summary;
    } catch (error) {
      console.log(error);
    }
  }

  async startTestRuns(runStartTime: number, testRunName: string): Promise<number> {
    try {
      const targets = parseNotifications(this.zebConfig);
      let r = await this.zebAgent.startTestRun({
        uuid: this.rerunConfig ? this.rerunConfig.testRunUuid : null,
        name: this.zebConfig.reportingRunDisplayName || testRunName,
        startedAt: new Date(runStartTime).toISOString(),
        framework: 'playwright',
        config: {
          environment: this.zebConfig.reportingRunEnvironment || '-',
          build: this.zebConfig.reportingRunBuild || '1.0 alpha',
        },
        milestone: {
          id: this.zebConfig.reportingMilestoneId,
          name: this.zebConfig.reportingMilestoneName,
        },
        notifications: {
          notifyOnEachFailure: this.zebConfig.reportingNotifyOnEachFailure,
          targets,
        },
      });

      if (isNaN(r.data.id)) {
        return Promise.reject('Failed to initiate test run');
      } else {
        this.testRunId = Number(r.data.id);
        return this.testRunId;
      }
    } catch (error) {
      console.log(error);
    }
  }

  async stopTestRuns(testRunId: number, runEndTime: string) {
    try {
      let r = await this.zebAgent.finishTestRun(testRunId, {
        endedAt: runEndTime,
      });
      return r;
    } catch (error) {
      console.log(error);
    }
  }

  async addTestRunTags(testRunId: number, tags: any[]) {
    try {
      let r = await this.zebAgent.addTestRunTags(testRunId, tags);
      return r;
    } catch (error) {
      console.log(error);
    }
  }

  async addTestTags(testRunId: number, tests) {
    try {
      const {results, errors} = await PromisePool.withConcurrency(this.zebAgent.concurrency)
        .for(tests)
        .process(async (test: testResult, index, pool) => {
          let r = await this.zebAgent.addTestTags(testRunId, test.testId, test.tags);
          return r;
        });

      return {results, errors};
    } catch (error) {
      console.log(error);
    }
  }

  async addScreenshots(testRunId: number, tests) {
    try {
      const {results, errors} = await PromisePool.withConcurrency(this.zebAgent.concurrency)
        .for(tests)
        .process(async (test: testResult, index, pool) => {
          let r = await this.zebAgent.attachScreenshot(
            testRunId,
            test.testId,
            test.attachment.screenshots
          );
          return r;
        });

      return {results, errors};
    } catch (error) {
      console.log(error);
    }
  }

  async addTestArtifacts(testRunId: number, tests) {
    try {
      const {results, errors} = await PromisePool.withConcurrency(this.zebAgent.concurrency)
        .for(tests)
        .process(async (test: testResult, index, pool) => {
          let r = await this.zebAgent.attachTestArtifacts(
            testRunId,
            test.testId,
            test.attachment.files
          );
          return r;
        });

      return {results, errors};
    } catch (error) {
      console.log(error);
    }
  }

  async sendTestSteps(testRunId: number, testResults: testResult[]) {
    try {
      let logEntries = [];
      for (const result of testResults) {
        logEntries = logEntries.concat(
          result.steps.map((s) => ({
            testId: result.testId,
            ...s,
          }))
        );
      }
      let r = await this.zebAgent.addTestLogs(testRunId, logEntries);
      return r;
    } catch (error) {
      console.log(error);
    }
  }

  async startTestExecutions(testRunId: number, tests) {
    try {
      const {results, errors} = await PromisePool.withConcurrency(this.zebAgent.concurrency)
        .for(tests)
        .process(async (test: testResult, index, pool) => {
          let testExecResponse = await this.zebAgent.startTestExecution(testRunId, {
            name: test.name,
            className: test.suiteName,
            methodName: test.name,
            maintainer: test.maintainer,
            startedAt: test.startedAt,
            argumentsIndex: 1,
          });
          let testId = testExecResponse.data.id;
          return {testId, ...test};
        });
      return {results, errors};
    } catch (error) {
      console.log(error);
    }
  }

  async startRerunTestExecutions(testRunId: number, tests) {
    try {
      const {results, errors} = await PromisePool.withConcurrency(this.zebAgent.concurrency)
        .for(tests)
        .process(async (test: testResult, index, pool) => {
          const rerunTest = this.rerunConfig.testsToRun.filter(
            (el: {
              id: number;
              name: string;
              correlationData: string;
              status: string;
              startedAt: string;
              endedAt: string;
            }) => el.name === test.name
          )[0];
          let testExecResponse = await this.zebAgent.startRerunTestExecution(
            testRunId,
            rerunTest.id,
            {
              name: test.name,
              className: test.suiteName,
              methodName: test.name,
              startedAt: test.startedAt,
              argumentsIndex: 1,
            }
          );
          let testId = testExecResponse.data.id;
          return {testId, ...test};
        });

      return {results, errors};
    } catch (error) {
      console.log(error);
    }
  }

  async finishTestExecutions(testRunId: number, tests: testResult[]) {
    try {
      const {results, errors} = await PromisePool.withConcurrency(this.zebAgent.concurrency)
        .for(tests)
        .process(async (test: testResult, index, pool) => {
          let r = await this.zebAgent.finishTestExecution(testRunId, test.testId, {
            result: test.status,
            reason: test.reason,
            endedAt: test.endedAt,
          });

          return r;
        });

      return {results, errors};
    } catch (error) {
      console.log(error);
    }
  }

  async sendTestSessions(testRunId: number, runStartTime: number, tests: testResult[]) {
    try {
      let sessionsWithVideoAttachments = [];
      const {results, errors} = await PromisePool.withConcurrency(this.zebAgent.concurrency)
        .for(tests)
        .process(async (test, index, pool) => {
          let sess = await this.zebAgent.startTestSession({
            browserCapabilities: test.browserCapabilities,
            startedAt: test.startedAt,
            testRunId: testRunId,
            testIds: test.testId,
          });

          let res = await this.zebAgent.finishTestSession(
            sess.data.id,
            testRunId,
            test.endedAt,
            test.testId
          );

          if (test.attachment.video.length > 0) {
            sessionsWithVideoAttachments.push({
              sessionId: sess.data.id,
              testId: test.testId,
            });
          }
          return res;
        });

      return {sessionsWithVideoAttachments, results, errors};
    } catch (error) {
      console.log(error);
    }
  }

  async addVideoArtifacts(
    testRunId: number,
    sessionsWithVideoAttachments: Record<string, number>[],
    tests: testResult[]
  ) {
    try {
      const {results, errors} = await PromisePool.withConcurrency(this.zebAgent.concurrency)
        .for(tests)
        .process(async (test, index, pool) => {
          let res;
          const result = sessionsWithVideoAttachments.filter((el) => el.testId === test.testId);
          if (result.length > 0) {
            res = await this.zebAgent.sendVideoArtifacts(
              testRunId,
              result[0].sessionId,
              test.attachment.video
            );
          }

          return res;
        });

      return {results, errors};
    } catch (error) {
      console.log(error);
    }
  }

  createRunTags() {
    let tags = [];
    if (!this.tcmConfig) {
      return tags;
    }

    Object.keys(this.tcmConfig).forEach((key) => {
      Object.keys(this.tcmConfig[key]).forEach((el) => {
        tags.push(this.tcmConfig[key][el]);
      });
    });
    return tags;
  }
}
export default ZebrunnerReporter;
