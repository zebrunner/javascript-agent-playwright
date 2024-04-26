import { ReporterDescription } from '@playwright/test';
import {
  FullConfig,
  Reporter,
  Suite,
  TestCase as PwTestCase,
  TestResult as PwTestResult,
} from '@playwright/test/reporter';
import { PromisePool } from '@supercharge/promise-pool';
import * as fs from 'fs';
import UAParser from 'ua-parser-js';
import ffmpeg from 'fluent-ffmpeg';
import { AxiosResponse } from 'axios';
import FormData from 'form-data';
import { v4 as uuidv4 } from 'uuid';
import ResultsParser, { testResult, testRun } from './ResultsParser';
import ZebAgent from './ZebAgent';
import ApiClient from './api-client';
import { EventNames } from './constant/custom-events';
import { ReportingConfig } from './reporting-config';
import { ExchangedRunContext } from './types/exchanged-run-context';
import { StartTestRunRequest } from './types/start-test-run';
import { UpdateTcmConfigsRequest } from './types/update-tcm-configs';
import { TestCase, UpsertTestTestCases } from './types/upsert-test-test-cases';
import { isNotEmptyArray } from './type-utils';

const parser = new UAParser();

export type TestStep = {
  // refactor
  level: 'INFO' | 'ERROR';
  timestamp: string;
  message: string;
  testId?: number;
};

class ZebrunnerReporter implements Reporter {
  private suite!: Suite;

  private zbrTestRunId: number;

  private mapPwTestIdToZbrTestId: Map<string, number>;

  private mapPwTestIdToZbrSessionId: Map<string, number>; // mb mapPwTestIdToZbrIds?

  private mapZbrTestIdToIsFinished: Map<number, boolean>;

  private areAllTestsStarted: boolean;

  private areAllTestsFinished: boolean;

  private logEntries: TestStep[];

  private concurrencyLevel: number;

  private zebAgent: ZebAgent;

  private apiClient: ApiClient;

  private reportingConfig: ReportingConfig;

  private exchangedRunContext: ExchangedRunContext;

  async onBegin(config: FullConfig, suite: Suite) {
    const reporters: ReporterDescription[] = config.reporter;
    const zebrunnerReporter: ReporterDescription = reporters.find((reporterAndConfig) =>
      reporterAndConfig[0].includes('javascript-agent-playwright'),
    );

    const reporterConfig: any = zebrunnerReporter[1];
    this.reportingConfig = new ReportingConfig(reporterConfig);

    if (!this.reportingConfig.enabled) {
      return;
    }

    this.apiClient = new ApiClient(this.reportingConfig);
    this.concurrencyLevel =
      parseInt(process.env.PW_CONCURRENT_TASKS) || reporterConfig.pwConcurrentTasks || 10;

    this.logEntries = [];
    this.mapPwTestIdToZbrTestId = new Map();
    this.mapPwTestIdToZbrSessionId = new Map();
    this.mapZbrTestIdToIsFinished = new Map();

    this.suite = suite;
    // this.zebAgent = new ZebAgent(this.reportingConfig);
    // await this.zebAgent.initialize();
    this.suite = await this.rerunResolver(suite);

    ////////// todo: run start time w/0 parser
    const resultsParser = new ResultsParser(this.suite, this.reportingConfig);
    await resultsParser.parse();
    const parsedResults = await resultsParser.getParsedResults();
    const runStartTime = resultsParser.getRunStartTime();
    //////////

    const testRunId = await this.startTestRunAndGetId(runStartTime);
    this.zbrTestRunId = testRunId;

    await this.saveTcmConfigs(testRunId);
  }

  private async rerunResolver(suite: Suite) {
    try {
      if (!process.env.REPORTING_RUN_CONTEXT) {
        console.log('no rerunResolver needed'); // to remove
        return suite;
      }

      const runContext = JSON.parse(process.env.REPORTING_RUN_CONTEXT);
      this.exchangedRunContext = await this.apiClient.exchangeRunContext(runContext);

      if (
        this.exchangedRunContext.mode === 'NEW' ||
        !this.exchangedRunContext.runOnlySpecificTests
      ) {
        return suite;
      }

      if (!this.exchangedRunContext.runAllowed) {
        throw new Error(`${this.exchangedRunContext.reason}`);
      }

      const recursiveTestsTraversal = (suite: Suite) => {
        // eslint-disable-next-line no-restricted-syntax
        for (const res of suite.suites) {
          if (res.tests.length > 0) {
            const suiteName = res.parent.title ? `${res.parent.title} > ${res.title}` : res.title;
            const launchInfo = suite.project();
            parser.setUA(launchInfo.use.userAgent);
            const systemOptions = parser.getResult();
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
                  if (
                    item.name === testName &&
                    browser === systemOptions.browser.name &&
                    version === systemOptions.browser.version &&
                    os === systemOptions.os.name
                  ) {
                    return true;
                  }
                  return false;
                },
              );
              if (isSuitableTest) {
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

    const { eventType, payload } = JSON.parse(chunk);

    if (eventType === EventNames.ADD_TEST_CASE) {
      console.log('//addTestTestCase');
      this.addTestTestCase(test, payload);
    } else if (eventType === EventNames.SET_MAINTAINER) {
      console.log('//SetMaintainer');
      test.maintainer = payload;
    }
  }

  private addTestTestCase(test: any, newTestCase: TestCase) {
    if (isNotEmptyArray(test.testCases)) {
      test.testCases = test.testCases.filter(
        (testCase: TestCase) =>
          // not the same test case
          testCase.tcmType !== newTestCase.tcmType ||
          testCase.testCaseId !== newTestCase.testCaseId,
      );

      test.testCases.push(newTestCase);
    } else {
      test.testCases = [newTestCase];
    }
  }

  async onTestBegin(pwTest: PwTestCase, pwTestResult: PwTestResult) {
    console.log(`Started test "${pwTest.title}"`);

    await this.waitUntil(
      () =>
        Boolean(
          this.zbrTestRunId &&
            this.mapPwTestIdToZbrTestId !== undefined &&
            this.mapZbrTestIdToIsFinished !== undefined &&
            this.mapPwTestIdToZbrSessionId !== undefined,
        ), // refactor
    );

    const testStartedAt = new Date(pwTestResult.startTime);

    const zbrTestId =
      this.exchangedRunContext?.mode === 'RERUN'
        ? await this.restartTestAndGetId(this.zbrTestRunId, pwTest, testStartedAt)
        : await this.startTestAndGetId(this.zbrTestRunId, pwTest, testStartedAt);

    const zbrTestSessionId = await this.startTestSessionAndGetId(
      this.zbrTestRunId,
      zbrTestId,
      pwTest,
      testStartedAt,
    );

    this.mapPwTestIdToZbrTestId.set(pwTest.id, zbrTestId);
    this.mapPwTestIdToZbrSessionId.set(pwTest.id, zbrTestSessionId);

    // if value exist then it means what onTestBegin ended
    this.mapZbrTestIdToIsFinished.set(zbrTestId, false);

    if (this.mapZbrTestIdToIsFinished.size === this.suite.allTests().length) {
      this.areAllTestsStarted = true;
    }
  }

  async onTestEnd(pwTest: PwTestCase, pwTestResult: PwTestResult) {
    console.log(`Finished test "${pwTest.title}": ${pwTestResult.status}`);

    await this.waitUntil(
      () =>
        this.mapPwTestIdToZbrTestId.has(pwTest.id) && this.mapPwTestIdToZbrSessionId.has(pwTest.id),
    ); // recheck flags? mb ptTestIdToIsFinished?
    const zbrTestId = this.mapPwTestIdToZbrTestId.get(pwTest.id);
    const zbrSessionId = this.mapPwTestIdToZbrSessionId.get(pwTest.id);
    await this.waitUntil(() => this.mapZbrTestIdToIsFinished.has(zbrTestId));
    await this.addTestTags(this.zbrTestRunId, zbrTestId, pwTest);
    const testAttachments = this.processAttachments(pwTestResult.attachments);
    await this.addTestScreenshots(this.zbrTestRunId, zbrTestId, testAttachments.screenshots);
    await this.addTestFiles(this.zbrTestRunId, zbrTestId, testAttachments.files);
    await this.addSessionVideos(this.zbrTestRunId, zbrSessionId, testAttachments.videos);
    this.logEntries.push(...this.getTestSteps(pwTestResult.steps, zbrTestId));
    const testSessionEndedAt = new Date();
    await this.finishTestSession(this.zbrTestRunId, zbrSessionId, zbrTestId, testSessionEndedAt);
    await this.finishTest(this.zbrTestRunId, zbrTestId, pwTestResult);

    console.log(`Finished uploading test "${pwTest.title}" data to Zebrunner`);

    this.mapZbrTestIdToIsFinished.set(zbrTestId, true);

    await this.waitUntil(() => this.areAllTestsStarted);

    if (
      Array.from(this.mapZbrTestIdToIsFinished.values()).every(
        (isTestFinished) => isTestFinished === true,
      )
    ) {
      this.areAllTestsFinished = true;
    }
  }

  async onEnd() {
    if (!this.reportingConfig.enabled) {
      // refactor
      console.log('Zebrunner agent disabled - skipped results upload');
      return;
    }

    try {
      await this.waitUntil(() => this.areAllTestsFinished);
      await this.sendTestsSteps(this.zbrTestRunId, this.logEntries);
      const testRunEndedAt = new Date();

      await this.finishTestRun(this.zbrTestRunId, testRunEndedAt);
      // todo: update time according to pwTestRunResult?
    } catch (error) {
      console.log('onEnd', error);
    }
  }

  async postResultsToZebrunner(runStartedAt: Date, testRun: testRun) {
    try {
      // console.log('postResultsToZebrunner'); // to remove

      // tests это parsedResult (testRun) из resultsParser
      // с подкинутыми айдишниками (testId) от нашей API

      // const tests =
      //   this.exchangedRunContext?.mode === 'RERUN'
      //     ? await this.restartTests(this.zbrTestRunId, testRun.tests)
      //     : await this.startTests(this.zbrTestRunId, testRun.tests);

      // could be moved to onStdOut
      tests.results.forEach((test) =>
        this.saveTestTestCases(this.zbrTestRunId, test.testId, test.testCases),
      );

      // await this.addTestTags(this.zbrTestRunId, tests.results);

      // await this.addScreenshots(this.zbrTestRunId, tests.results);

      // await this.addTestArtifacts(this.zbrTestRunId, tests.results);

      // await this.sendTestSteps(this.zbrTestRunId, tests.results);

      // await this.finishTestExecutions(this.zbrTestRunId, tests.results);

      // const startTestSessions = await this.startTestSessions(this.zbrTestRunId, tests.results);

      // await this.addVideoArtifacts(this.zbrTestRunId, startTestSessions.results);

      // await this.finishTestSessions(this.zbrTestRunId, startTestSessions.results);
      // await this.finishTestRun(this.zbrTestRunId);
    } catch (error) {
      console.log(error);
    }
  }

  private async startTestRunAndGetId(startedAt: Date): Promise<number> {
    const runUuid = this.exchangedRunContext ? this.exchangedRunContext.testRunUuid : null;
    const request = new StartTestRunRequest(runUuid, startedAt, this.reportingConfig);
    const zbrTestRunId = await this.apiClient.startTestRun(
      this.reportingConfig.projectKey,
      request,
    );

    return zbrTestRunId;
  }

  private async startTestAndGetId(zbrTestRunId: number, pwTest: PwTestCase, testStartedAt: Date) {
    try {
      const suiteTitle = pwTest.parent.title;
      const suiteParentTitle = pwTest.parent.parent.title;
      const suiteName = suiteParentTitle ? `${suiteParentTitle} > ${suiteTitle}` : suiteTitle;

      const browserCapabilities = this.parseBrowserCapabilities(pwTest.parent.project());
      // ? pwTest.parent.parent?

      const zbrTestId = await this.apiClient.startTest(zbrTestRunId, {
        name: `${suiteName} > ${pwTest.title}`,
        className: suiteName,
        methodName: `${suiteName} > ${pwTest.title}`,
        maintainer: pwTest.maintainer || 'anonymous', // maintainer could be added to pwTest using onStdOut
        startedAt: testStartedAt,
        correlationData: JSON.stringify({
          browser: browserCapabilities.browser.name,
          version: browserCapabilities.browser.version,
          os: browserCapabilities.os.name,
        }),
      });

      return zbrTestId;
    } catch (error) {
      console.log(error);
    }
  }

  private async restartTestAndGetId(zbrTestRunId: number, pwTest: PwTestCase, testStartedAt: Date) {
    try {
      console.log('restartTest'); // to remove

      const suiteTitle = pwTest.parent.title;
      const suiteParentTitle = pwTest.parent.parent.title;
      const suiteName = suiteParentTitle ? `${suiteParentTitle} > ${suiteTitle}` : suiteTitle;

      const browserCapabilities = this.parseBrowserCapabilities(pwTest.parent.project());
      // ? pwTest.parent.parent?

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
          if (
            el.name === `${suiteName} > ${pwTest.title}` &&
            browser === browserCapabilities.browser.name &&
            version === browserCapabilities.browser.version &&
            os === browserCapabilities.os.name
          ) {
            return true;
          }
          return false;
        },
      )[0];
      const zbrTestId = await this.apiClient.restartTest(zbrTestRunId, rerunTest.id, {
        name: `${suiteName} > ${pwTest.title}`,
        className: suiteName,
        methodName: `${suiteName} > ${pwTest.title}`,
        startedAt: testStartedAt,
        correlationData: JSON.stringify({
          browser: browserCapabilities.browser.name,
          version: browserCapabilities.browser.version,
          os: browserCapabilities.os.name,
        }),
      });

      return zbrTestId;
    } catch (error) {
      console.log(error);
    }
  }

  private async startTestSessionAndGetId(
    zbrTestRunId: number,
    zbrTestId: number,
    pwTest: PwTestCase,
    testStartedAt: Date,
  ) {
    try {
      const browserCapabilities = this.parseBrowserCapabilities(pwTest.parent.project());
      const sessionId = await this.apiClient.startTestSession(zbrTestRunId, {
        sessionId: uuidv4(),
        initiatedAt: testStartedAt,
        startedAt: testStartedAt,
        desiredCapabilities: {
          browserName: browserCapabilities.browser.name || 'n/a',
          browserVersion: browserCapabilities.browser.version || 'n/a',
          platformName: browserCapabilities.os.name || 'n/a',
        },
        capabilities: {
          browserName: browserCapabilities.browser.name || 'n/a',
          browserVersion: browserCapabilities.browser.version || 'n/a',
          platformName: browserCapabilities.os.name || 'n/a',
        },
        testIds: [zbrTestId],
      });

      return sessionId;
    } catch (error) {
      console.log(error);
    }
  }

  private async addTestTags(zbrTestRunId: number, zbrTestId: number, pwTest: PwTestCase) {
    try {
      const r = await this.apiClient.attachTestLabels(zbrTestRunId, zbrTestId, {
        items: this.getTestTags(pwTest.title, pwTest.tcmTestOptions),
      });
      return r;
    } catch (error) {
      console.log(error);
    }
  }

  private async addTestScreenshots(zbrTestRunId: number, zbrTestId: number, screenshotsArray) {
    try {
      if (screenshotsArray.length === 0) return;

      const screenshotsPromises = screenshotsArray.map((screenshot) => {
        const file = fs.readFileSync(screenshot.path);
        return this.apiClient.uploadTestScreenshot(zbrTestRunId, zbrTestId, Buffer.from(file));
      });

      await Promise.all(screenshotsPromises);
    } catch (error) {
      console.log(error);
    }
  }

  private async addTestFiles(
    zbrTestRunId?: number,
    zbrTestId?: number,
    artifactsAttachments?: Record<string, string>[],
  ): Promise<AxiosResponse> {
    if (artifactsAttachments.length === 0) {
      return;
    }
    try {
      const artifactsPromises = artifactsAttachments.map((file) => {
        const formData = new FormData();
        formData.append('file', fs.createReadStream(file.path));

        return this.apiClient.uploadTestArtifact(
          zbrTestRunId,
          zbrTestId,
          formData.getHeaders()['content-type'],
          formData,
        );
      });

      await Promise.all(artifactsPromises);
    } catch (error) {
      console.log(error);
    }
  }

  private async addSessionVideos(
    zbrTestRunId: number,
    zbrSessionId: number,
    videoPathsArray: Record<string, string>[],
  ) {
    try {
      if (videoPathsArray.length === 0) {
        return;
      }

      const videoPromises = videoPathsArray.map((video) => {
        const formData = new FormData();
        formData.append('video', fs.createReadStream(video.path));

        return this.apiClient.uploadSessionArtifact(
          zbrTestRunId,
          zbrSessionId,
          formData.getHeaders()['content-type'],
          this.getFileSizeInBytes(video.path),
          formData,
        );
      });

      await Promise.all(videoPromises);
    } catch (error) {
      console.log(error);
    }
  }

  private async finishTestSession(
    zbrTestRunId: number,
    zbrTestSessionId: number,
    zbrTestId: number,
    testEndedAt: Date,
  ) {
    try {
      await this.apiClient.finishTestSession(zbrTestRunId, zbrTestSessionId, {
        endedAt: testEndedAt,
        testIds: [zbrTestId],
      });
    } catch (error) {
      console.log(error);
    }
  }

  private async finishTest(zbrTestRunId: number, zbrTestId: number, pwTestResult: PwTestResult) {
    try {
      const startedAt = new Date(pwTestResult.startTime);
      let endedAt = new Date(startedAt.getTime() + pwTestResult.duration);

      if (startedAt.getTime() === endedAt.getTime()) {
        endedAt = new Date(endedAt.getTime() + 1);
      }

      const response = await this.apiClient.finishTest(zbrTestRunId, zbrTestId, {
        result: this.determineStatus(pwTestResult.status),
        reason: `${this.cleanseReason(pwTestResult.error?.message)} \n ${this.cleanseReason(
          pwTestResult.error?.stack,
        )}`,
        endedAt,
      });

      return response;
    } catch (error) {
      console.log(error);
    }
  }

  private async sendTestsSteps(zbrTestRunId: number, logEntries: TestStep[]) {
    try {
      await this.apiClient.sendLogs(zbrTestRunId, logEntries);
    } catch (error) {
      console.log(error);
    }
  }

  private async finishTestRun(testRunId: number, testRunEndedAt: Date): Promise<void> {
    console.log('//finishTestRun');

    await this.apiClient.finishTestRun(testRunId, { endedAt: testRunEndedAt });
  }

  private parseBrowserCapabilities(launchInfo) {
    parser.setUA(launchInfo.use.userAgent);
    return parser.getResult();
  }

  private determineStatus(status) {
    if (status === 'failed') return 'FAILED';
    if (status === 'passed') return 'PASSED';
    if (status === 'skipped') return 'SKIPPED';
    return 'ABORTED';
  }

  private cleanseReason(rawReason) {
    return rawReason
      ? rawReason
          .replace(/\u001b\[2m/g, '')
          .replace(/\u001b\[22m/g, '')
          .replace(/\u001b\[31m/g, '')
          .replace(/\u001b\[39m/g, '')
          .replace(/\u001b\[32m/g, '')
          .replace(/\u001b\[27m/g, '')
          .replace(/\u001b\[7m/g, '')
      : '';
  }

  private getTestTags(testTitle, tcmTestOptions) {
    const tags = testTitle.match(/@\w*/g) || [];

    if (tcmTestOptions) {
      tcmTestOptions.forEach((el) => {
        tags.push(el);
      });
    }

    if (tags.length !== 0) {
      return tags.map((c) => {
        if (typeof c === 'string') {
          return { key: 'tag', value: c.replace('@', '') };
        }
        if (typeof c === 'object') {
          return c;
        }
      });
    }
    return null;
  }

  private processAttachments(attachment) {
    if (attachment) {
      const attachmentObj = {
        videos: [],
        files: [],
        screenshots: [],
      };
      attachment.forEach(async (el) => {
        if (el.contentType === 'video/webm') {
          await this.convertVideo(el.path, 'mp4');
          attachmentObj.videos.push({
            path: el.path.replace('.webm', '.mp4'),
            timestamp: Date.now(),
          });
        }
        if (el.contentType === 'application/zip') {
          attachmentObj.files.push({
            path: el.path,
            timestamp: Date.now(),
          });
        }
        if (el.contentType === 'image/png') {
          attachmentObj.screenshots.push({
            path: el.path,
            timestamp: Date.now(),
          });
        }
      });
      return attachmentObj;
    }
    return null;
  }

  private getFileSizeInBytes = (filename) => {
    const stats = fs.statSync(filename);
    return stats.size;
  };

  private async convertVideo(path, format) {
    try {
      const fileName = path.replace('.webm', '');
      const convertedFilePath = `${fileName}.${format}`;
      await ffmpeg(path).toFormat(format).outputOptions(['-vsync 2']).saveToFile(convertedFilePath);
    } catch (error) {
      console.log(error);
    }
  }

  private getTestSteps(steps, zbrTestId: number): TestStep[] {
    const testSteps = [];
    for (const testStep of steps) {
      testSteps.push({
        timestamp: new Date(testStep.startTime).getTime(),
        message: testStep.error
          ? `${this.cleanseReason(testStep.error?.message)} \n ${this.cleanseReason(
              testStep.error?.stack,
            )}`
          : testStep.title,
        level: testStep.error ? 'ERROR' : 'INFO',
        testId: zbrTestId,
      });
    }

    return testSteps;
  }

  private waitUntil = (predFn: () => boolean) => {
    const poll = (resolve) => (predFn() ? resolve() : setTimeout(() => poll(resolve), 500));
    return new Promise(poll);
  };

  private async saveTcmConfigs(testRunId: number): Promise<void> {
    const request = new UpdateTcmConfigsRequest(this.reportingConfig);

    if (request.hasAnyValue) {
      this.apiClient.updateTcmConfigs(testRunId, request);
    }
  }

  private async saveTestTestCases(
    testRunId: number,
    testId: number,
    testCases: TestCase[],
  ): Promise<void> {
    if (isNotEmptyArray(testCases)) {
      const request: UpsertTestTestCases = { items: testCases };

      this.apiClient.upsertTestTestCases(testRunId, testId, request);
    }
  }
}

export default ZebrunnerReporter;
