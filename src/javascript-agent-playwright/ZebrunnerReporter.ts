import { ReporterDescription } from '@playwright/test';
import { FullConfig, Reporter, Suite, TestResult as PwTestResult } from '@playwright/test/reporter';
import * as fs from 'fs';
import { AxiosResponse } from 'axios';
import FormData from 'form-data';
import { v4 as uuidv4 } from 'uuid';
import { ZebrunnerApiClient } from './ZebrunnerApiClient';
import { EVENT_NAMES } from './constants/events';
import { ReportingConfig } from './ReportingConfig';
import { ExchangedRunContext } from './ZebrunnerApiClient/types/ExchangedRunContext';
import { StartTestRunRequest } from './ZebrunnerApiClient/types/StartTestRunRequest';
import { UpdateTcmConfigsRequest } from './ZebrunnerApiClient/types/UpdateTcmConfigsRequest';
import { ZbrTestCase, TestStep, ExtendedPwTestCase, FileArtifact } from './types';
import {
  cleanseReason,
  determineStatus,
  getFileSizeInBytes,
  getFullSuiteName,
  getTestSteps,
  getTestLabelsFromTitle,
  parseBrowserCapabilities,
  processAttachments,
  until,
  isNotEmptyArray,
  recursiveTestsTraversal,
  isJsonString,
  getErrorsStringFromMap,
  getCustomArtifactObject,
} from './helpers';

class ZebrunnerReporter implements Reporter {
  private reportingConfig: ReportingConfig;
  private apiClient: ZebrunnerApiClient;

  private zbrRunId: number;
  private zbrRunLabels: { key: string; value: string }[];
  private zbrRunArtifactReferences: { name: string; value: string }[];
  private zbrRunArtifacts: FileArtifact[];

  private errors: Map<string, number>;

  private totalTestCount: number;
  private mapPwTestIdToZbrTestId: Map<string, number>;
  private mapPwTestIdToStatus: Map<string, 'started' | 'reverted' | 'finished'>;

  private exchangedRunContext: ExchangedRunContext;

  async onBegin(config: FullConfig, suite: Suite) {
    if (!suite.allTests().length) {
      console.log('No tests found.');
      process.exit();
    }

    const runStartTime = new Date();

    const reporters: ReporterDescription[] = config.reporter;
    const zebrunnerReporter: ReporterDescription = reporters.find((reporterAndConfig) =>
      reporterAndConfig[0].includes('javascript-agent-playwright'),
    );

    this.reportingConfig = new ReportingConfig(zebrunnerReporter[1]);

    if (!this.reportingConfig.enabled) {
      console.log('Zebrunner agent disabled - skipping results upload.');
      return;
    }

    this.zbrRunLabels = [];
    this.zbrRunArtifactReferences = [];
    this.zbrRunArtifacts = [];

    this.mapPwTestIdToZbrTestId = new Map();
    this.mapPwTestIdToStatus = new Map();
    this.errors = new Map();

    this.apiClient = new ZebrunnerApiClient(this.reportingConfig);
    suite = await this.rerunResolver(suite);
    this.totalTestCount = suite.allTests().length;

    this.zbrRunId = await this.startTestRunAndGetId(runStartTime);
    // if (!this.zbrRunId) {
    //   console.log('Failed auth');
    //   process.exit();
    // }
    await this.saveTestRunTcmConfigs(this.zbrRunId);
  }

  private async rerunResolver(suite: Suite) {
    try {
      if (!process.env.REPORTING_RUN_CONTEXT) {
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

      recursiveTestsTraversal(suite, this.exchangedRunContext);

      return suite;
    } catch (error) {
      this.logError('rerunResolver', error);
    }
  }

  async onTestBegin(pwTest: ExtendedPwTestCase, pwTestResult: PwTestResult) {
    const fullTestName = `${getFullSuiteName(pwTest)} > ${pwTest.title}`;
    console.log(`Started test "${fullTestName}".`);

    if (!this.reportingConfig.enabled) {
      return;
    }

    pwTest.labels = getTestLabelsFromTitle(pwTest.title) || [];
    pwTest.artifactReferences = [];
    pwTest.customLogs = [];
    pwTest.customArtifacts = [];

    await until(() => !!this.zbrRunId); // zebrunner run initialized

    const testStartedAt = new Date(pwTestResult.startTime);

    const zbrTestId =
      this.exchangedRunContext?.mode === 'RERUN'
        ? await this.restartTestAndGetId(this.zbrRunId, pwTest, testStartedAt)
        : await this.startTestAndGetId(this.zbrRunId, pwTest, testStartedAt);

    this.mapPwTestIdToZbrTestId.set(pwTest.id, zbrTestId);
    this.mapPwTestIdToStatus.set(pwTest.id, 'started');
  }

  onStdOut(chunk: string, pwTest: ExtendedPwTestCase) {
    // onStdOut must not be async function because it must always finish before onTestEnd

    if (chunk.includes('connect') || chunk.includes('POST') || !this.reportingConfig.enabled) {
      return;
    }

    if (!isJsonString(chunk)) {
      console.log(chunk.trim());
      pwTest?.customLogs.push({
        timestamp: new Date().getTime(),
        message: `console.log("${chunk.trim()}")`,
        level: 'INFO',
      });
      return;
    }

    const { eventType, payload } = JSON.parse(chunk);

    if (eventType === EVENT_NAMES.ATTACH_TEST_CASE) {
      this.addZbrTestCase(pwTest, payload);
    } else if (eventType === EVENT_NAMES.ATTACH_TEST_MAINTAINER) {
      pwTest.maintainer = payload;
    } else if (eventType === EVENT_NAMES.ATTACH_TEST_LOG) {
      pwTest.customLogs.push({ timestamp: payload.timestamp, message: payload.message, level: 'INFO' });
    } else if (eventType === EVENT_NAMES.ATTACH_TEST_RUN_LABELS) {
      this.zbrRunLabels.push(...payload.values.map((value: string) => ({ key: payload.key, value })));
    } else if (eventType === EVENT_NAMES.ATTACH_TEST_RUN_ARTIFACT_REFERENCES) {
      const index = this.zbrRunArtifactReferences.findIndex((ar) => ar.name === payload.name);
      if (index === -1) {
        this.zbrRunArtifactReferences.push({ name: payload.name, value: payload.value });
      } else {
        this.zbrRunArtifactReferences[index].value = payload.value;
      }
    } else if (eventType === EVENT_NAMES.ATTACH_TEST_ARTIFACT_REFERENCES) {
      const index = pwTest.artifactReferences.findIndex((ar) => ar.name === payload.name);
      if (index === -1) {
        pwTest.artifactReferences.push({ name: payload.name, value: payload.value });
      } else {
        pwTest.artifactReferences[index].value = payload.value;
      }
    } else if (eventType === EVENT_NAMES.ATTACH_TEST_LABELS) {
      pwTest.labels.push(...payload.values.map((value: string) => ({ key: payload.key, value })));
    } else if (eventType === EVENT_NAMES.REVERT_TEST_REGISTRATION) {
      pwTest.shouldBeReverted = true;
    } else if (eventType === EVENT_NAMES.ATTACH_RUN_ARTIFACT) {
      this.zbrRunArtifacts.push(getCustomArtifactObject(payload));
    } else if (eventType === EVENT_NAMES.ATTACH_TEST_ARTIFACT) {
      pwTest.customArtifacts.push(getCustomArtifactObject(payload));
    } else if (eventType === EVENT_NAMES.LOG_ERROR) {
      this.logError(payload.stage, payload.message);
    }
  }

  async onTestEnd(pwTest: ExtendedPwTestCase, pwTestResult: PwTestResult) {
    const fullTestName = `${getFullSuiteName(pwTest)} > ${pwTest.title}`;
    console.log(`Finished test "${fullTestName}": ${pwTestResult.status}.`);

    if (!this.reportingConfig.enabled) {
      return;
    }

    await until(() => this.mapPwTestIdToStatus.get(pwTest.id) === 'started'); // zebrunner test initialized

    const zbrTestId = this.mapPwTestIdToZbrTestId.get(pwTest.id);

    if (pwTest.shouldBeReverted) {
      await this.revertTestRegistration(this.zbrRunId, zbrTestId);
      this.mapPwTestIdToStatus.set(pwTest.id, 'reverted');
    } else {
      await this.attachZbrTestCases(this.zbrRunId, zbrTestId, pwTest.testCases);
      await this.attachTestMaintainer(this.zbrRunId, zbrTestId, pwTest.maintainer);
      await this.attachTestLabels(this.zbrRunId, zbrTestId, pwTest.labels);
      const testAttachments = await processAttachments(pwTestResult.attachments);
      await this.attachTestScreenshots(this.zbrRunId, zbrTestId, testAttachments.screenshots);
      await this.attachTestFiles(this.zbrRunId, zbrTestId, [...testAttachments.files, ...pwTest.customArtifacts]);
      await this.attachTestArtifactReferences(this.zbrRunId, zbrTestId, pwTest.artifactReferences);
      await this.attachTestLogs(this.zbrRunId, [
        ...getTestSteps(pwTestResult.steps, zbrTestId),
        ...pwTest.customLogs.map((log: TestStep) => ({ ...log, testId: zbrTestId })),
      ]);

      if (testAttachments.videos.length) {
        const sessionStartedAt = new Date(pwTestResult.startTime);
        const zbrSessionId = await this.startTestSessionAndGetId(this.zbrRunId, zbrTestId, pwTest, sessionStartedAt);
        const sessionEndedAt = new Date();
        await this.finishTestSession(this.zbrRunId, zbrSessionId, sessionEndedAt);
        await this.attachSessionVideos(this.zbrRunId, zbrSessionId, testAttachments.videos);
      }

      await this.finishTest(this.zbrRunId, zbrTestId, pwTestResult, pwTest.maintainer);

      console.log(`Finished uploading test "${fullTestName}" data to Zebrunner.`);

      this.mapPwTestIdToStatus.set(pwTest.id, 'finished');
    }
  }

  async onEnd() {
    if (!this.reportingConfig.enabled) {
      console.log('All tests finished.');
      return;
    }

    await until(
      () =>
        Array.from(this.mapPwTestIdToStatus.values()).every(
          (status) => status === 'finished' || status === 'reverted',
        ) && this.mapPwTestIdToStatus.size === this.totalTestCount,
    ); // all zebrunner tests finished

    await this.attachRunArtifactReferences(this.zbrRunId, this.zbrRunArtifactReferences);
    await this.attachRunLabels(this.zbrRunId, this.zbrRunLabels);
    await this.attachRunFiles(this.zbrRunId, this.zbrRunArtifacts);

    const testRunEndedAt = new Date();
    await this.finishTestRun(this.zbrRunId, testRunEndedAt);
    console.log(
      `Zebrunner agent finished work${
        this.errors.size ? `ing with errors in the following stage(s): ${getErrorsStringFromMap(this.errors)}` : ''
      }.`,
    );
  }

  private async startTestRunAndGetId(startedAt: Date): Promise<number> {
    try {
      const runUuid = this.exchangedRunContext ? this.exchangedRunContext.testRunUuid : null;
      const request = new StartTestRunRequest(runUuid, startedAt, this.reportingConfig);
      const zbrRunId = await this.apiClient.startTestRun(this.reportingConfig.projectKey, request);

      return zbrRunId;
    } catch (error) {
      this.logError('startTestRunAndGetId', error);
    }
  }

  private async attachTestMaintainer(zbrRunId: number, zbrTestId: number, maintainer: string) {
    try {
      if (maintainer) {
        await this.apiClient.updateTest(zbrRunId, zbrTestId, { maintainer });
      }
    } catch (error) {
      this.logError('attachTestMaintainer', error);
    }
  }

  private async saveTestRunTcmConfigs(testRunId: number): Promise<void> {
    try {
      const request = new UpdateTcmConfigsRequest(this.reportingConfig);

      if (request.hasAnyValue) {
        await this.apiClient.updateTcmConfigs(testRunId, request);
      }
    } catch (error) {
      this.logError('saveTestRunTcmConfigs', error);
    }
  }

  private async startTestAndGetId(zbrRunId: number, pwTest: ExtendedPwTestCase, testStartedAt: Date) {
    try {
      const fullSuiteName = getFullSuiteName(pwTest);
      const browserCapabilities = parseBrowserCapabilities(pwTest.parent.project());

      const zbrTestId = await this.apiClient.startTest(zbrRunId, {
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
      this.logError('startTestAndGetId', error);
    }
  }

  private async restartTestAndGetId(zbrRunId: number, pwTest: ExtendedPwTestCase, testStartedAt: Date) {
    try {
      const fullSuiteName = getFullSuiteName(pwTest);
      const browserCapabilities = parseBrowserCapabilities(pwTest.parent.project());

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
      const zbrTestId = await this.apiClient.restartTest(zbrRunId, rerunTest.id, {
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
      this.logError('restartTestAndGetId', error);
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
    zbrRunId: number,
    zbrTestId: number,
    pwTest: ExtendedPwTestCase,
    testStartedAt: Date,
  ) {
    try {
      const browserCapabilities = parseBrowserCapabilities(pwTest.parent.project());
      const sessionId = await this.apiClient.startTestSession(zbrRunId, {
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
      this.logError('startTestSessionAndGetId', error);
    }
  }

  private async attachZbrTestCases(zbrRunId: number, zbrTestId: number, testCases: ZbrTestCase[]): Promise<void> {
    try {
      if (isNotEmptyArray(testCases)) {
        await this.apiClient.upsertTestTestCases(zbrRunId, zbrTestId, { items: testCases });
      }
    } catch (error) {
      this.logError('attachZbrTestCases', error);
    }
  }

  private async attachTestLabels(zbrRunId: number, zbrTestId: number, labels: { key: string; value: string }[]) {
    try {
      await this.apiClient.attachTestLabels(zbrRunId, zbrTestId, { items: labels });
    } catch (error) {
      this.logError('attachTestLabels', error);
    }
  }

  private async attachTestScreenshots(zbrRunId: number, zbrTestId: number, screenshots: FileArtifact[]) {
    try {
      if (!screenshots.length) return;

      const screenshotsPromises = screenshots.map((screenshot) => {
        const file = Buffer.isBuffer(screenshot.pathOrBuffer)
          ? screenshot.pathOrBuffer
          : fs.readFileSync(screenshot.pathOrBuffer);

        return this.apiClient.uploadTestScreenshot(zbrRunId, zbrTestId, file, screenshot.contentType);
      });

      await Promise.all(screenshotsPromises);
    } catch (error) {
      this.logError('attachTestScreenshots', error);
    }
  }

  private async attachTestFiles(zbrRunId?: number, zbrTestId?: number, files?: FileArtifact[]): Promise<AxiosResponse> {
    if (!files.length) {
      return;
    }
    try {
      const filePromises = files.map((file) => {
        const formData = new FormData();
        const isBuffer = Buffer.isBuffer(file.pathOrBuffer);
        formData.append(
          'file',
          isBuffer ? file.pathOrBuffer : fs.createReadStream(file.pathOrBuffer),
          file.name ? file.name : isBuffer ? `file_${new Date(file.timestamp).toISOString()}` : null,
        );

        return this.apiClient.uploadTestArtifact(zbrRunId, zbrTestId, formData.getHeaders()['content-type'], formData);
      });

      await Promise.all(filePromises);
    } catch (error) {
      this.logError('attachTestFiles', error);
    }
  }

  private async attachSessionVideos(zbrRunId: number, zbrSessionId: number, videos: FileArtifact[]) {
    try {
      if (!videos.length) {
        return;
      }

      const videoPromises = videos.map((video) => {
        const formData = new FormData();
        const isBuffer = Buffer.isBuffer(video.pathOrBuffer);
        formData.append(
          'video',
          isBuffer ? video.pathOrBuffer : fs.createReadStream(video.pathOrBuffer),
          video.name ? video.name : isBuffer ? `video_${new Date(video.timestamp).toISOString()}` : null,
        );

        return this.apiClient.uploadSessionArtifact(
          zbrRunId,
          zbrSessionId,
          formData.getHeaders()['content-type'],
          getFileSizeInBytes(video.pathOrBuffer),
          formData,
        );
      });

      await Promise.all(videoPromises);
    } catch (error) {
      this.logError('attachSessionVideos', error);
    }
  }

  private async attachRunFiles(zbrRunId?: number, files?: FileArtifact[]) {
    try {
      if (!files.length) {
        return;
      }

      const filePromises = files.map((file) => {
        const formData = new FormData();
        const isBuffer = Buffer.isBuffer(file.pathOrBuffer);
        formData.append(
          'file',
          isBuffer ? file.pathOrBuffer : fs.createReadStream(file.pathOrBuffer),
          file.name ? file.name : isBuffer ? `file_${new Date(file.timestamp).toISOString()}` : null,
        );

        return this.apiClient.uploadTestRunArtifact(zbrRunId, formData.getHeaders()['content-type'], formData);
      });

      await Promise.all(filePromises);
    } catch (error) {
      this.logError('attachRunFiles', error);
    }
  }

  private async finishTestSession(zbrRunId: number, zbrTestSessionId: number, testEndedAt: Date) {
    try {
      await this.apiClient.finishTestSession(zbrRunId, zbrTestSessionId, { endedAt: testEndedAt });
    } catch (error) {
      this.logError('finishTestSession', error);
    }
  }

  private async finishTest(zbrRunId: number, zbrTestId: number, pwTestResult: PwTestResult, maintainer: string) {
    try {
      const startedAt = new Date(pwTestResult.startTime);
      let endedAt = new Date(startedAt.getTime() + pwTestResult.duration);

      if (startedAt.getTime() === endedAt.getTime()) {
        endedAt = new Date(endedAt.getTime() + 1);
      }

      await this.apiClient.finishTest(zbrRunId, zbrTestId, {
        result: determineStatus(pwTestResult.status),
        reason: `${cleanseReason(pwTestResult.error?.message)} \n ${cleanseReason(pwTestResult.error?.stack)}`,
        endedAt,
      });
    } catch (error) {
      this.logError('finishTest', error);
    }
  }

  private async attachTestLogs(zbrRunId: number, zbrLogEntries: TestStep[]) {
    try {
      await this.apiClient.sendLogs(zbrRunId, zbrLogEntries);
    } catch (error) {
      this.logError('attachTestLogs', error);
    }
  }

  private async finishTestRun(testRunId: number, testRunEndedAt: Date): Promise<void> {
    try {
      await this.apiClient.finishTestRun(testRunId, { endedAt: testRunEndedAt });
    } catch (error) {
      this.logError('finishTestRun', error);
    }
  }

  private async attachRunLabels(zbrRunId: number, labels: { key: string; value: string }[]) {
    try {
      await this.apiClient.attachTestRunLabels(zbrRunId, { items: labels });
    } catch (error) {
      this.logError('attachRunLabels', error);
    }
  }

  private async attachRunArtifactReferences(zbrRunId: number, artifactReferences: { name: string; value: string }[]) {
    try {
      await this.apiClient.attachTestRunArtifactReferences(zbrRunId, { items: artifactReferences });
    } catch (error) {
      this.logError('attachRunArtifactReferences', error);
    }
  }

  private async attachTestArtifactReferences(
    zbrRunId: number,
    zbrTestId: number,
    artifactReferences: { name: string; value: string }[],
  ) {
    try {
      await this.apiClient.attachTestArtifactReferences(zbrRunId, zbrTestId, { items: artifactReferences });
    } catch (error) {
      this.logError('attachTestArtifactReferences', error);
    }
  }

  private async revertTestRegistration(zbrRunId: number, zbrTestId: number) {
    try {
      await this.apiClient.revertTestRegistration(zbrRunId, zbrTestId);
    } catch (error) {
      this.logError('revertTestRegistration', error);
    }
  }

  private logError(errorStage: string, error: unknown) {
    if (this.errors.has(errorStage)) {
      this.errors.set(errorStage, this.errors.get(errorStage) + 1);
    } else {
      this.errors.set(errorStage, 1);
    }
    console.log(`Error during ${errorStage}:`, error);
  }
}

export default ZebrunnerReporter;
