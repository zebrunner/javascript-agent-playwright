import { ReporterDescription } from '@playwright/test';
import {
  FullConfig,
  Reporter,
  Suite,
  TestCase as PwTestCase,
  TestResult as PwTestResult,
} from '@playwright/test/reporter';
import * as fs from 'fs';
import UAParser from 'ua-parser-js';
import ffmpeg from 'fluent-ffmpeg';
import { AxiosResponse } from 'axios';
import FormData from 'form-data';
import { v4 as uuidv4 } from 'uuid';
import ApiClient from './ApiClient';
import { EventNames } from './constant/custom-events';
import { ReportingConfig } from './ReportingConfig';
import { ExchangedRunContext } from './types/exchanged-run-context';
import { StartTestRunRequest } from './types/start-test-run';
import { UpdateTcmConfigsRequest } from './types/update-tcm-configs';
import { ZbrTestCase, UpsertTestTestCases } from './types/upsert-test-test-cases';
import { isNotEmptyArray } from './type-utils';

const parser = new UAParser();

export type TestStep = {
  // refactor
  level: 'INFO' | 'ERROR';
  timestamp: string;
  message: string;
  testId?: number;
};

interface ExtendedPwTestCase extends PwTestCase {
  maintainer: string;
  testCases: ZbrTestCase[];
}

class ZebrunnerReporter implements Reporter {
  private suite!: Suite;

  private zbrTestRunId: number;

  private mapPwTestIdToZbrTestId: Map<string, number>;

  private mapPwTestIdToZbrSessionId: Map<string, number>;

  private mapPwTestIdToStatus: Map<string, 'started' | 'finished'>;

  private areAllTestsStarted: boolean;

  private areAllTestsFinished: boolean;

  private zbrLogEntries: TestStep[];

  private apiClient: ApiClient;

  private reportingConfig: ReportingConfig;

  private exchangedRunContext: ExchangedRunContext;

  async onBegin(config: FullConfig, suite: Suite) {
    const runStartTime = new Date();

    const reporters: ReporterDescription[] = config.reporter;
    const zebrunnerReporter: ReporterDescription = reporters.find((reporterAndConfig) =>
      reporterAndConfig[0].includes('javascript-agent-playwright'),
    );

    this.reportingConfig = new ReportingConfig(zebrunnerReporter[1]);

    this.zbrLogEntries = [];
    this.mapPwTestIdToZbrTestId = new Map();
    this.mapPwTestIdToZbrSessionId = new Map();
    this.mapPwTestIdToStatus = new Map();

    this.suite = await this.rerunResolver(suite);
    this.apiClient = new ApiClient(this.reportingConfig);

    if (!this.reportingConfig.enabled) {
      return;
    }

    this.zbrTestRunId = await this.startTestRunAndGetId(runStartTime);
    await this.saveTcmConfigs(this.zbrTestRunId);
  }

  private async rerunResolver(suite: Suite) {
    try {
      if (!process.env.REPORTING_RUN_CONTEXT) {
        console.log('no rerunResolver needed'); // to remove
        return suite;
      }

      const runContext = JSON.parse(process.env.REPORTING_RUN_CONTEXT);
      this.exchangedRunContext = await this.apiClient.exchangeRunContext(runContext);

      if (this.exchangedRunContext.mode === 'NEW' || !this.exchangedRunContext.runOnlySpecificTests) {
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

  async onTestBegin(pwTest: ExtendedPwTestCase, pwTestResult: PwTestResult) {
    const fullTestName = `${this.getFullSuiteName(pwTest)} > ${pwTest.title}`;
    console.log(`Started test "${fullTestName}"`);

    await this.waitUntil(() => !!this.zbrTestRunId); // zebrunner run initialized

    const testStartedAt = new Date(pwTestResult.startTime);

    const zbrTestId =
      this.exchangedRunContext?.mode === 'RERUN'
        ? await this.restartTestAndGetId(this.zbrTestRunId, pwTest, testStartedAt)
        : await this.startTestAndGetId(this.zbrTestRunId, pwTest, testStartedAt);

    const zbrTestSessionId = await this.startTestSessionAndGetId(this.zbrTestRunId, zbrTestId, pwTest, testStartedAt);

    this.mapPwTestIdToZbrTestId.set(pwTest.id, zbrTestId);
    this.mapPwTestIdToZbrSessionId.set(pwTest.id, zbrTestSessionId);
    this.mapPwTestIdToStatus.set(pwTest.id, 'started');

    if (this.mapPwTestIdToStatus.size === this.suite.allTests().length) {
      this.areAllTestsStarted = true;
    }
  }

  onStdOut(chunk: string, pwTest: ExtendedPwTestCase, pwTestResult: PwTestResult) {
    if (chunk.includes('connect') || chunk.includes('POST')) {
      return;
    }

    const { eventType, payload } = JSON.parse(chunk);

    if (eventType === EventNames.ADD_TEST_CASE) {
      console.log('//addTestTestCase');
      this.addZbrTestCase(pwTest, payload);
    } else if (eventType === EventNames.SET_MAINTAINER) {
      console.log('//SetMaintainer');
      pwTest.maintainer = payload;
    }
  }

  async onTestEnd(pwTest: ExtendedPwTestCase, pwTestResult: PwTestResult) {
    const fullTestName = `${this.getFullSuiteName(pwTest)} > ${pwTest.title}`;
    console.log(`Finished test "${fullTestName}": ${pwTestResult.status}`);

    await this.waitUntil(() => this.mapPwTestIdToStatus.has(pwTest.id)); // zebrunner test initialized

    const zbrTestId = this.mapPwTestIdToZbrTestId.get(pwTest.id);
    const zbrSessionId = this.mapPwTestIdToZbrSessionId.get(pwTest.id);

    await this.saveZbrTestCases(this.zbrTestRunId, zbrTestId, pwTest.testCases);
    await this.addTestTags(this.zbrTestRunId, zbrTestId, pwTest);
    const testAttachments = this.processAttachments(pwTestResult.attachments);
    await this.addTestScreenshots(this.zbrTestRunId, zbrTestId, testAttachments.screenshots);
    await this.addTestFiles(this.zbrTestRunId, zbrTestId, testAttachments.files);
    await this.addSessionVideos(this.zbrTestRunId, zbrSessionId, testAttachments.videos);
    this.zbrLogEntries.push(...this.getTestSteps(pwTestResult.steps, zbrTestId));
    const testSessionEndedAt = new Date();
    await this.finishTestSession(this.zbrTestRunId, zbrSessionId, zbrTestId, testSessionEndedAt);

    await this.finishTest(this.zbrTestRunId, zbrTestId, pwTestResult);

    console.log(`Finished uploading test "${fullTestName}" data to Zebrunner`);

    this.mapPwTestIdToStatus.set(pwTest.id, 'finished');

    await this.waitUntil(() => this.areAllTestsStarted);

    if (Array.from(this.mapPwTestIdToStatus.values()).every((status) => status === 'finished')) {
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

      await this.sendTestsSteps(this.zbrTestRunId, this.zbrLogEntries);
      const testRunEndedAt = new Date();

      await this.finishTestRun(this.zbrTestRunId, testRunEndedAt);
    } catch (error) {
      console.log('onEnd', error);
    }
  }

  private async startTestRunAndGetId(startedAt: Date): Promise<number> {
    const runUuid = this.exchangedRunContext ? this.exchangedRunContext.testRunUuid : null;
    const request = new StartTestRunRequest(runUuid, startedAt, this.reportingConfig);
    const zbrTestRunId = await this.apiClient.startTestRun(this.reportingConfig.projectKey, request);

    return zbrTestRunId;
  }

  private async startTestAndGetId(zbrTestRunId: number, pwTest: ExtendedPwTestCase, testStartedAt: Date) {
    try {
      const fullSuiteName = this.getFullSuiteName(pwTest);
      const browserCapabilities = this.parseBrowserCapabilities(pwTest.parent.project());

      const zbrTestId = await this.apiClient.startTest(zbrTestRunId, {
        name: `${fullSuiteName} > ${pwTest.title}`,
        className: fullSuiteName,
        methodName: `${fullSuiteName} > ${pwTest.title}`,
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

  private async restartTestAndGetId(zbrTestRunId: number, pwTest: ExtendedPwTestCase, testStartedAt: Date) {
    try {
      console.log('restartTest'); // to remove
      const fullSuiteName = this.getFullSuiteName(pwTest);
      const browserCapabilities = this.parseBrowserCapabilities(pwTest.parent.project());

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
            el.name === `${fullSuiteName} > ${pwTest.title}` &&
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
        name: `${fullSuiteName} > ${pwTest.title}`,
        className: fullSuiteName,
        methodName: `${fullSuiteName} > ${pwTest.title}`,
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

  private addZbrTestCase(pwTest: ExtendedPwTestCase, newTestCase: ZbrTestCase) {
    if (isNotEmptyArray(pwTest.testCases)) {
      pwTest.testCases = pwTest.testCases.filter(
        (testCase: ZbrTestCase) =>
          // not the same test case
          testCase.tcmType !== newTestCase.tcmType || testCase.testCaseId !== newTestCase.testCaseId,
      );

      pwTest.testCases.push(newTestCase);
    } else {
      pwTest.testCases = [newTestCase];
    }
  }

  private async startTestSessionAndGetId(
    zbrTestRunId: number,
    zbrTestId: number,
    pwTest: ExtendedPwTestCase,
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

  private async saveZbrTestCases(zbrTestRunId: number, zbrTestId: number, testCases: ZbrTestCase[]): Promise<void> {
    if (isNotEmptyArray(testCases)) {
      const request: UpsertTestTestCases = { items: testCases };

      this.apiClient.upsertTestTestCases(zbrTestRunId, zbrTestId, request);
    }
  }

  private async addTestTags(zbrTestRunId: number, zbrTestId: number, pwTest: ExtendedPwTestCase) {
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

  private async sendTestsSteps(zbrTestRunId: number, zbrLogEntries: TestStep[]) {
    try {
      await this.apiClient.sendLogs(zbrTestRunId, zbrLogEntries);
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

  private getFileSizeInBytes = (filename: string) => {
    const stats = fs.statSync(filename);
    return stats.size;
  };

  private async convertVideo(path: string, format: string) {
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
          ? `${this.cleanseReason(testStep.error?.message)} \n ${this.cleanseReason(testStep.error?.stack)}`
          : testStep.title,
        level: testStep.error ? 'ERROR' : 'INFO',
        testId: zbrTestId,
      });
    }

    return testSteps;
  }

  private getFullSuiteName(pwTest: ExtendedPwTestCase) {
    const suiteTitle = pwTest.parent.title;
    const suiteParentTitle = pwTest.parent.parent.title;
    return suiteParentTitle ? `${suiteParentTitle} > ${suiteTitle}` : suiteTitle;
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
}

export default ZebrunnerReporter;
