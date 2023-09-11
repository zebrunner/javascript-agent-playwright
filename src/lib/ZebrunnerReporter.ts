import { ReporterDescription } from '@playwright/test';
import { FullConfig, Reporter, Suite } from '@playwright/test/reporter';
import { PromisePool } from '@supercharge/promise-pool';
import ResultsParser, { testResult, testRun } from './ResultsParser';
import ZebAgent from './ZebAgent';
import ApiClient from './api-client';
import { EventNames } from './constant/custom-events';
import { ReportingConfig } from './reporting-config';
import { ExchangedRunContext } from './types/exchanged-run-context';
import { FinishTestRunRequest } from './types/finish-test-run';
import { StartTestRunRequest } from './types/start-test-run';
import { UpdateTcmConfigsRequest } from './types/update-tcm-configs';
import { TestCase, UpsertTestTestCases } from './types/upsert-test-test-cases';
import { isNotEmptyArray } from './type-utils';
let UAParser = require('ua-parser-js');
let parser = new UAParser();

class ZebrunnerReporter implements Reporter {

  private suite!: Suite;

  private zebAgent: ZebAgent;
  private apiClient: ApiClient;
  private reportingConfig: ReportingConfig;
  private exchangedRunContext: ExchangedRunContext;

  async onBegin(config: FullConfig, suite: Suite) {
    const reporters: ReporterDescription[] = config.reporter;
    const zebrunnerReporter: ReporterDescription = reporters.find((reporterAndConfig) => reporterAndConfig[0].includes("ZebrunnerReporter.ts"));

    const reporterConfig: any = zebrunnerReporter[1]
    this.reportingConfig = new ReportingConfig(reporterConfig);

    if (!this.reportingConfig.enabled) {
      return;
    }

    this.apiClient = new ApiClient(this.reportingConfig);

    this.suite = suite;
    this.zebAgent = new ZebAgent(this.reportingConfig);
    await this.zebAgent.initialize();
    this.suite = await this.rerunResolver(suite);
  }

  async rerunResolver(suite: Suite) {
    try {
      if (!process.env.REPORTING_RUN_CONTEXT) {
        return suite;
      }

      const runContext = JSON.parse(process.env.REPORTING_RUN_CONTEXT)
      this.exchangedRunContext = await this.apiClient.exchangeRunContext(runContext);

      if (this.exchangedRunContext.mode === 'NEW' || !this.exchangedRunContext.runOnlySpecificTests) {
        return suite;
      }

      if (!this.exchangedRunContext.runAllowed) {
        throw new Error(`${this.exchangedRunContext.reason}`);
      }

      const recursiveTestsTraversal = (suite) => {
        for (const res of suite.suites) {
          if (res.tests.length > 0) {
            const suiteName = res.parent.title ? `${res.parent.title} > ${res.title}` : res.title;
            const launchInfo = suite.project();
            parser.setUA(launchInfo.use.userAgent);
            const systemOptions = parser.getResult()
            res.tests = res.tests.filter((el) => {
              const testName = `${suiteName} > ${el.title}`;
              const isSuitableTest = this.exchangedRunContext.testsToRun.some(
                (item: {
                  id: number;
                  name: string;
                  correlationData: string;
                  status: string;
                  startedAt: string;
                  endedAt: string;
                }) => {
                  const { browser, version, os } = JSON.parse(item.correlationData);
                  if (item.name === testName && browser === systemOptions.browser.name && version === systemOptions.browser.version && os === systemOptions.os.name) {
                    return true;
                  }
                  return false;
                });
              if (isSuitableTest) {
                return true;
              }
              return false;
            });
          }
          recursiveTestsTraversal(res)
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

    const { eventType, payload } = JSON.parse(chunk);

    if (eventType === EventNames.ADD_TEST_CASE) {
      test.testCases = test.testCases?.concat(payload) || [payload]
    } else if (eventType === EventNames.SET_MAINTAINER) {
      test.maintainer = payload;
    }
  }

  async onEnd() {
    if (!this.reportingConfig.enabled) {
      console.log('Zebrunner agent disabled - skipped results upload');
      return;
    }

    try {
      let resultsParser = new ResultsParser(this.suite, this.reportingConfig);
      await resultsParser.parse();
      let parsedResults = await resultsParser.getParsedResults();

      await this.postResultsToZebrunner(resultsParser.getRunStartTime(), parsedResults);

    } catch (error) {
      console.log('onEnd', error);
    }
  }

  async postResultsToZebrunner(runStartedAt: Date, testRun: testRun) {
    try {
      const testRunId = await this.startTestRun(runStartedAt);

      await this.saveTcmConfigs(testRunId)

      let tests = this.exchangedRunContext?.mode == 'RERUN'
        ? await this.restartTests(testRunId, testRun.tests)
        : await this.startTests(testRunId, testRun.tests);

      tests.results.forEach(test => this.saveTestTestCases(testRunId, test.testId, test.testCases));

      await this.addTestTags(testRunId, tests.results);
      await this.addScreenshots(testRunId, tests.results);
      await this.addTestArtifacts(testRunId, tests.results);
      await this.sendTestSteps(testRunId, tests.results);
      await this.finishTestExecutions(testRunId, tests.results);

      let startTestSessions = await this.startTestSessions(testRunId, tests.results);

      await this.addVideoArtifacts(testRunId, startTestSessions.results);

      await this.finishTestSessions(testRunId, startTestSessions.results)
      await this.finishTestRun(testRunId);
    } catch (error) {
      console.log(error);
    }
  }

  private async startTestRun(startedAt: Date): Promise<number> {
    const runUuid = this.exchangedRunContext ? this.exchangedRunContext.testRunUuid : null;
    const request = new StartTestRunRequest(runUuid, startedAt, this.reportingConfig);

    return await this.apiClient.startTestRun(this.reportingConfig.projectKey, request);
  }

  private async finishTestRun(testRunId: number): Promise<void> {
    const request = new FinishTestRunRequest()

    await this.apiClient.finishTestRun(testRunId, request);
  }

  async addTestTags(testRunId: number, tests) {
    try {
      const { results, errors } = await PromisePool.withConcurrency(this.zebAgent.concurrencyLevel)
        .for(tests)
        .process(async (test: testResult, index, pool) => {
          let r = await this.zebAgent.addTestTags(testRunId, test.testId, test.tags);
          return r;
        });

      return { results, errors };
    } catch (error) {
      console.log(error);
    }
  }

  async addScreenshots(testRunId: number, tests) {
    try {
      const { results, errors } = await PromisePool.withConcurrency(this.zebAgent.concurrencyLevel)
        .for(tests)
        .process(async (test: testResult, index, pool) => {
          let r = await this.zebAgent.attachScreenshot(
            testRunId,
            test.testId,
            test.attachment.screenshots
          );
          return r;
        });

      return { results, errors };
    } catch (error) {
      console.log(error);
    }
  }

  async addTestArtifacts(testRunId: number, tests) {
    try {
      const { results, errors } = await PromisePool.withConcurrency(this.zebAgent.concurrencyLevel)
        .for(tests)
        .process(async (test: testResult, index, pool) => {
          let r = await this.zebAgent.attachTestArtifacts(
            testRunId,
            test.testId,
            test.attachment.files
          );
          return r;
        });

      return { results, errors };
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

  async startTests(testRunId: number, tests) {
    try {
      const { results, errors } = await PromisePool.withConcurrency(this.zebAgent.concurrencyLevel)
        .for(tests)
        .process(async (test: testResult, index, pool) => {
          let testExecResponse = await this.zebAgent.startTestExecution(testRunId, {
            name: test.name,
            className: test.suiteName,
            methodName: test.name,
            maintainer: test.maintainer,
            startedAt: test.startedAt,
            correlationData: JSON.stringify({
              browser: test.browserCapabilities.browser.name,
              version: test.browserCapabilities.browser.version,
              os: test.browserCapabilities.os.name
            })
          });
          let testId = testExecResponse.data.id;
          return { testId, ...test };
        });
      return { results, errors };
    } catch (error) {
      console.log(error);
    }
  }

  async restartTests(testRunId: number, tests) {
    try {
      const { results, errors } = await PromisePool.withConcurrency(this.zebAgent.concurrencyLevel)
        .for(tests)
        .process(async (test: testResult, index, pool) => {
          const rerunTest = this.exchangedRunContext.testsToRun.filter(
            (el: {
              id: number;
              name: string;
              correlationData: string;
              status: string;
              startedAt: string;
              endedAt: string;
            }) => {
              const { browser, version, os } = JSON.parse(el.correlationData);
              if (el.name === test.name && browser === test.browserCapabilities.browser.name && version === test.browserCapabilities.browser.version && os === test.browserCapabilities.os.name) {
                return true
              }
              return false;
            }
          )[0];
          let testExecResponse = await this.zebAgent.startRerunTestExecution(
            testRunId,
            rerunTest.id,
            {
              name: test.name,
              className: test.suiteName,
              methodName: test.name,
              startedAt: test.startedAt,
              correlationData: JSON.stringify({
                browser: test.browserCapabilities.browser.name,
                version: test.browserCapabilities.browser.version,
                os: test.browserCapabilities.os.name
              })
            }
          );
          let testId = testExecResponse.data.id;
          return { testId, ...test };
        });

      return { results, errors };
    } catch (error) {
      console.log(error);
    }
  }

  async finishTestExecutions(testRunId: number, tests: testResult[]) {
    try {
      const { results, errors } = await PromisePool.withConcurrency(this.zebAgent.concurrencyLevel)
        .for(tests)
        .process(async (test: testResult, index, pool) => {
          if (new Date(test.startedAt).getTime() === new Date(test.endedAt).getTime()) {
            test.endedAt = new Date(new Date(test.endedAt).getTime() + 1);
          }
          let r = await this.zebAgent.finishTestExecution(testRunId, test.testId, {
            result: test.status,
            reason: test.reason,
            endedAt: test.endedAt,
          });

          return r;
        });

      return { results, errors };
    } catch (error) {
      console.log(error);
    }
  }

  async startTestSessions(testRunId: number, tests: testResult[]) {
    try {
      const { results, errors } = await PromisePool.withConcurrency(this.zebAgent.concurrencyLevel)
        .for(tests)
        .process(async (test, index, pool) => {
          const sess = await this.zebAgent.startTestSession({
            browserCapabilities: test.browserCapabilities,
            startedAt: test.startedAt,
            testRunId: testRunId,
            testIds: test.testId,
          });

          const sessionId = sess.data.id;
          return { sessionId, ...test };
        });
      return { results, errors };
    } catch (error) {
      console.log(error);
    }
  }

  async finishTestSessions(testRunId: number, tests: testResult[]) {
    try {
      const { results, errors } = await PromisePool.withConcurrency(this.zebAgent.concurrencyLevel)
        .for(tests)
        .process(async (test, index, pool) => {
          return await this.zebAgent.finishTestSession(
            test.sessionId,
            testRunId,
            test.endedAt,
            test.testId
          );
        });
      return { results, errors };
    } catch (error) {
      console.log(error);
    }
  }

  async addVideoArtifacts(
    testRunId: number,
    tests: testResult[]
  ) {
    try {
      const { results, errors } = await PromisePool.withConcurrency(this.zebAgent.concurrencyLevel)
        .for(tests)
        .process(async (test, index, pool) => {
          return await this.zebAgent.sendVideoArtifacts(
            testRunId,
            test.sessionId,
            test.attachment.video
          );
        });
      return { results, errors };
    } catch (error) {
      console.log(error);
    }
  }

  private async saveTcmConfigs(testRunId: number): Promise<void> {
    const request = new UpdateTcmConfigsRequest(this.reportingConfig);

    if (request.hasAnyValue) {
      this.apiClient.updateTcmConfigs(testRunId, request);
    }
  }

  private async saveTestTestCases(testRunId: number, testId: number, testCases: TestCase[]): Promise<void> {
    if (isNotEmptyArray(testCases)) {
      const request: UpsertTestTestCases = { items: testCases };

      this.apiClient.upsertTestTestCases(testRunId, testId, request);
    }
  }

}

export default ZebrunnerReporter;
