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
import { ZbrTestCase, TestStep, ExtendedPwTestCase } from './types';
import {
  cleanseReason,
  determineStatus,
  getFileSizeInBytes,
  getFullSuiteName,
  getTestSteps,
  getTestLabelsFromTitle,
  parseBrowserCapabilities,
  processAttachments,
  waitUntil,
  isNotEmptyArray,
  recursiveTestsTraversal,
} from './helpers';

class ZebrunnerReporter implements Reporter {
  private reportingConfig: ReportingConfig;
  private suite!: Suite;
  private apiClient: ZebrunnerApiClient;

  private zbrTestRunId: number;
  private zbrLogEntries: TestStep[];

  private mapPwTestIdToZbrTestId: Map<string, number>;
  private mapPwTestIdToZbrSessionId: Map<string, number>;
  private mapPwTestIdToStatus: Map<string, 'started' | 'toRevert' | 'reverted' | 'finished'>;

  private areAllTestsStarted: boolean;
  private areAllTestsFinished: boolean;

  private exchangedRunContext: ExchangedRunContext;

  async onBegin(config: FullConfig, suite: Suite) {
    const runStartTime = new Date();

    const reporters: ReporterDescription[] = config.reporter;
    const zebrunnerReporter: ReporterDescription = reporters.find((reporterAndConfig) =>
      reporterAndConfig[0].includes('javascript-agent-playwright'),
    );

    this.reportingConfig = new ReportingConfig(zebrunnerReporter[1]);

    if (!this.reportingConfig.enabled) {
      console.log('Zebrunner agent disabled - skipping results upload');
      return;
    }

    this.zbrLogEntries = [];
    this.mapPwTestIdToZbrTestId = new Map();
    this.mapPwTestIdToZbrSessionId = new Map();
    this.mapPwTestIdToStatus = new Map();

    this.suite = await this.rerunResolver(suite);
    this.apiClient = new ZebrunnerApiClient(this.reportingConfig);

    this.zbrTestRunId = await this.startTestRunAndGetId(runStartTime);
    await this.saveTestRunTcmConfigs(this.zbrTestRunId);
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
      console.log('Error during rerunResolver:', error);
    }
  }

  async onTestBegin(pwTest: ExtendedPwTestCase, pwTestResult: PwTestResult) {
    const fullTestName = `${getFullSuiteName(pwTest)} > ${pwTest.title}`;
    console.log(`Started test "${fullTestName}"`);

    if (!this.reportingConfig.enabled) {
      return;
    }

    pwTest.labels = getTestLabelsFromTitle(pwTest.title) || [];

    await waitUntil(() => !!this.zbrTestRunId); // zebrunner run initialized

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

  onStdOut(chunk: string, pwTest: ExtendedPwTestCase) {
    if (chunk.includes('connect') || chunk.includes('POST') || !this.reportingConfig.enabled) {
      return;
    }

    const { eventType, payload } = JSON.parse(chunk);

    if (eventType === EVENT_NAMES.ADD_TEST_CASE) {
      this.addZbrTestCase(pwTest, payload);
    } else if (eventType === EVENT_NAMES.SET_MAINTAINER) {
      pwTest.maintainer = payload;
    } else if (eventType === EVENT_NAMES.ADD_TEST_LOG) {
      this.zbrLogEntries.push({
        timestamp: new Date().getTime(),
        message: payload,
        level: 'INFO',
        testId: this.mapPwTestIdToZbrTestId.get(pwTest.id), // refactor: testId could be undefined it zbrTestId not yet loaded
      });
    } else if (eventType === EVENT_NAMES.ATTACH_TEST_RUN_LABELS) {
      this.attachRunLabels(payload.key, payload.values);
    } else if (eventType === EVENT_NAMES.ATTACH_TEST_RUN_ARTIFACT_REFERENCES) {
      this.attachRunArtifactReference(payload.name, payload.value);
    } else if (eventType === EVENT_NAMES.ATTACH_TEST_LABELS) {
      pwTest.labels.push(...payload.values.map((value: string) => ({ key: payload.key, value })));
    } else if (eventType === EVENT_NAMES.ATTACH_TEST_ARTIFACT_REFERENCES) {
      this.attachTestArtifactReference(payload.name, payload.value, pwTest.id);
    } else if (eventType === EVENT_NAMES.REVERT_TEST_REGISTRATION) {
      this.mapPwTestIdToStatus.set(pwTest.id, 'toRevert');
    }
  }

  async onTestEnd(pwTest: ExtendedPwTestCase, pwTestResult: PwTestResult) {
    const fullTestName = `${getFullSuiteName(pwTest)} > ${pwTest.title}`;
    console.log(`Finished test "${fullTestName}": ${pwTestResult.status}`);

    if (!this.reportingConfig.enabled) {
      return;
    }

    await waitUntil(() => this.mapPwTestIdToStatus.has(pwTest.id)); // zebrunner test initialized
    const zbrTestId = this.mapPwTestIdToZbrTestId.get(pwTest.id);

    if (this.mapPwTestIdToStatus.get(pwTest.id) === 'toRevert') { // refactor: recheck if "toRevert" status actually needed (add pwTest field instead?)
      await this.revertTestRegistration(this.zbrTestRunId, zbrTestId);
      this.mapPwTestIdToStatus.set(pwTest.id, 'reverted');
    } else {
      const zbrSessionId = this.mapPwTestIdToZbrSessionId.get(pwTest.id);

      await this.saveZbrTestCases(this.zbrTestRunId, zbrTestId, pwTest.testCases);
      await this.addTestLabels(this.zbrTestRunId, zbrTestId, pwTest);
      const testAttachments = processAttachments(pwTestResult.attachments);
      await this.addTestScreenshots(this.zbrTestRunId, zbrTestId, testAttachments.screenshots);
      await this.addTestFiles(this.zbrTestRunId, zbrTestId, testAttachments.files);
      this.zbrLogEntries.push(...getTestSteps(pwTestResult.steps, zbrTestId));
      const testSessionEndedAt = new Date();
      await this.finishTestSession(this.zbrTestRunId, zbrSessionId, zbrTestId, testSessionEndedAt);
      await this.addSessionVideos(this.zbrTestRunId, zbrSessionId, testAttachments.videos);

      await this.finishTest(this.zbrTestRunId, zbrTestId, pwTestResult);

      console.log(`Finished uploading test "${fullTestName}" data to Zebrunner`);

      this.mapPwTestIdToStatus.set(pwTest.id, 'finished');
    }

    await waitUntil(() => this.areAllTestsStarted);

    if (
      Array.from(this.mapPwTestIdToStatus.values()).every((status) => status === 'finished' || status === 'reverted')
    ) {
      this.areAllTestsFinished = true;
    }
  }

  async onEnd() {
    console.log('Playwright test run finished');

    if (!this.reportingConfig.enabled) {
      return;
    }

    await waitUntil(() => this.areAllTestsFinished);

    await this.sendTestsSteps(this.zbrTestRunId, this.zbrLogEntries);

    const testRunEndedAt = new Date();
    await this.finishTestRun(this.zbrTestRunId, testRunEndedAt);
    console.log('Zebrunner agent finished work');
  }

  private async startTestRunAndGetId(startedAt: Date): Promise<number> {
    try {
      const runUuid = this.exchangedRunContext ? this.exchangedRunContext.testRunUuid : null;
      const request = new StartTestRunRequest(runUuid, startedAt, this.reportingConfig);
      const zbrTestRunId = await this.apiClient.startTestRun(this.reportingConfig.projectKey, request);

      return zbrTestRunId;
    } catch (error) {
      console.log('Error during startTestRunAndGetId:', error);
    }
  }

  private async saveTestRunTcmConfigs(testRunId: number): Promise<void> {
    try {
      const request = new UpdateTcmConfigsRequest(this.reportingConfig);

      if (request.hasAnyValue) {
        await this.apiClient.updateTcmConfigs(testRunId, request);
      }
    } catch (error) {
      console.log('Error during saveTcmConfigs:', error);
    }
  }

  private async startTestAndGetId(zbrTestRunId: number, pwTest: ExtendedPwTestCase, testStartedAt: Date) {
    try {
      const fullSuiteName = getFullSuiteName(pwTest);
      const browserCapabilities = parseBrowserCapabilities(pwTest.parent.project());

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
      console.log('Error during startTestAndGetId:', error);
    }
  }

  private async restartTestAndGetId(zbrTestRunId: number, pwTest: ExtendedPwTestCase, testStartedAt: Date) {
    try {
      console.log('restartTest'); // to remove
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
      console.log('Error during restartTestAndGetId:', error);
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
      const browserCapabilities = parseBrowserCapabilities(pwTest.parent.project());
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
      console.log('Error during startTestSessionAndGetId:', error);
    }
  }

  private async saveZbrTestCases(zbrTestRunId: number, zbrTestId: number, testCases: ZbrTestCase[]): Promise<void> {
    try {
      if (isNotEmptyArray(testCases)) {
        await this.apiClient.upsertTestTestCases(zbrTestRunId, zbrTestId, { items: testCases });
      }
    } catch (error) {
      console.log('Error during saveZbrTestCases:', error);
    }
  }

  private async addTestLabels(zbrTestRunId: number, zbrTestId: number, pwTest: ExtendedPwTestCase) {
    try {
      await this.apiClient.attachTestLabels(zbrTestRunId, zbrTestId, {
        items: pwTest.labels,
      });
    } catch (error) {
      console.log('Error during addTestTags:', error);
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
      console.log('Error during addTestScreenshots:', error);
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
      console.log('Error during addTestFiles:', error);
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
          getFileSizeInBytes(video.path),
          formData,
        );
      });

      await Promise.all(videoPromises);
    } catch (error) {
      console.log('Error during addSessionVideos:', error);
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
      console.log('Error during finishTestSession:', error);
    }
  }

  private async finishTest(zbrTestRunId: number, zbrTestId: number, pwTestResult: PwTestResult) {
    try {
      const startedAt = new Date(pwTestResult.startTime);
      let endedAt = new Date(startedAt.getTime() + pwTestResult.duration);

      if (startedAt.getTime() === endedAt.getTime()) {
        endedAt = new Date(endedAt.getTime() + 1);
      }

      await this.apiClient.finishTest(zbrTestRunId, zbrTestId, {
        result: determineStatus(pwTestResult.status),
        reason: `${cleanseReason(pwTestResult.error?.message)} \n ${cleanseReason(pwTestResult.error?.stack)}`,
        endedAt,
      });
    } catch (error) {
      console.log('Error during finishTest:', error);
    }
  }

  private async sendTestsSteps(zbrTestRunId: number, zbrLogEntries: TestStep[]) {
    try {
      await this.apiClient.sendLogs(zbrTestRunId, zbrLogEntries);
    } catch (error) {
      console.log('Error during sendTestsSteps:', error);
    }
  }

  private async finishTestRun(testRunId: number, testRunEndedAt: Date): Promise<void> {
    try {
      await this.apiClient.finishTestRun(testRunId, { endedAt: testRunEndedAt });
    } catch (error) {
      console.log('Error during finishTestRun:', error);
    }
  }

  private async attachRunLabels(key: string, values: string[]) {
    try {
      await waitUntil(() => !!this.zbrTestRunId); // zebrunner run initialized
      await this.apiClient.attachTestRunLabels(this.zbrTestRunId, { items: values.map((value) => ({ key, value })) });
    } catch (error) {
      console.log('Error during attachRunLabels:', error);
    }
  }

  private async attachRunArtifactReference(name: string, value: string) {
    try {
      await waitUntil(() => !!this.zbrTestRunId); // zebrunner run initialized
      await this.apiClient.attachTestRunArtifactReferences(this.zbrTestRunId, { items: [{ name, value }] });
    } catch (error) {
      console.log('Error during attachRunArtifactReference:', error);
    }
  }

  private async attachTestArtifactReference(name: string, value: string, pwTestId: string) {
    try {
      await waitUntil(() => !!this.zbrTestRunId && this.mapPwTestIdToStatus.has(pwTestId)); // zebrunner run and test initialized
      await this.apiClient.attachTestArtifactReferences(this.zbrTestRunId, this.mapPwTestIdToZbrTestId.get(pwTestId), {
        items: [{ name, value }],
      });
    } catch (error) {
      console.log('Error during attachTestArtifactReference:', error);
    }
  }

  private async revertTestRegistration(zbrTestRunId: number, zbrTestId: number) {
    try {
      await this.apiClient.revertTestRegistration(zbrTestRunId, zbrTestId);
    } catch (error) {
      console.log('Error during revertTestRegistration:', error);
    }
  }
}

export default ZebrunnerReporter;
