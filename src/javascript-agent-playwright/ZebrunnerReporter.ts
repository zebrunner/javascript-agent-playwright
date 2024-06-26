import { ReporterDescription as PwReporterDescription } from '@playwright/test';
import {
  FullConfig as PwFullConfig,
  Reporter as PwReporter,
  Suite as PwSuite,
  TestResult as PwTestResult,
} from '@playwright/test/reporter';
import * as fs from 'fs';
import { AxiosResponse } from 'axios';
import FormData from 'form-data';
import { v4 as uuidv4 } from 'uuid';
import { ZebrunnerApiClient } from './ZebrunnerApiClient';
import { EVENT_NAMES } from './constants/events';
import { ReportingConfig } from './ReportingConfig';
import { ExchangedLaunchContext } from './ZebrunnerApiClient/types/ExchangedLaunchContext';
import { StartLaunchRequest } from './ZebrunnerApiClient/types/StartLaunchRequest';
import { UpdateTcmConfigsRequest } from './ZebrunnerApiClient/types/UpdateTcmConfigsRequest';
import { ZbrTestCase, TestLog, ExtendedPwTestCase, FileArtifact } from './types';
import { Labels } from './constants/labels';
import {
  cleanseReason,
  determineStatus,
  getFileSizeInBytes,
  getFullSuiteName,
  getTestLogs,
  getTestLabelsFromTitle,
  parseBrowserCapabilities,
  processAttachments,
  until,
  isNotEmptyArray,
  recursiveTestsTraversal,
  isJsonString,
  getErrorsStringFromMap,
  getCustomArtifactObject,
  createPwStepObject,
  isNotBlankString,
  getFinishedTestCount,
} from './helpers';

class ZebrunnerReporter implements PwReporter {
  private reportingConfig: ReportingConfig;
  private apiClient: ZebrunnerApiClient;

  private zbrLaunchId: number;
  private zbrLaunchLabels: { key: string; value: string }[];
  private zbrLaunchArtifactReferences: { name: string; value: string }[];
  private zbrLaunchArtifacts: FileArtifact[];

  private errors: Map<string, number>;

  private totalTestCount: number;
  private pwTestIdToZbrTestId: Map<string, number>;
  private pwTestIdToZbrStartedTry: Map<string, number>; // number is an index of pw test try which was started/restarted in Zebrunner
  private pwTestIdToZbrFinishedTry: Map<string, number>; // number is an index of pw test try which was finished in Zebrunner

  private exchangedLaunchContext: ExchangedLaunchContext;

  async onBegin(config: PwFullConfig, suite: PwSuite) {
    if (!suite.allTests().length) {
      console.log('No tests found.');
      process.exit();
    }

    const launchStartTime = new Date();

    const reporters: PwReporterDescription[] = config.reporter;
    const zebrunnerReporter: PwReporterDescription = reporters.find((reporterAndConfig) =>
      reporterAndConfig[0].includes('javascript-agent-playwright'),
    );

    this.reportingConfig = new ReportingConfig(zebrunnerReporter[1]);

    if (!this.reportingConfig.enabled) {
      console.log('Zebrunner agent disabled - skipping results upload.');
      return;
    }

    this.zbrLaunchLabels = [];
    this.zbrLaunchArtifactReferences = [];
    this.zbrLaunchArtifacts = [];

    this.errors = new Map();

    this.pwTestIdToZbrTestId = new Map();
    this.pwTestIdToZbrStartedTry = new Map();
    this.pwTestIdToZbrFinishedTry = new Map();

    this.apiClient = new ZebrunnerApiClient(this.reportingConfig);
    suite = await this.rerunResolver(suite);
    this.totalTestCount = suite.allTests().length;

    this.zbrLaunchId = await this.startLaunchAndGetId(launchStartTime);

    if (isNotBlankString(this.reportingConfig.launch.locale)) {
      await this.attachLaunchLabels(this.zbrLaunchId, [
        {
          key: Labels.LOCALE,
          value: this.reportingConfig.launch.locale,
        },
      ]);
    }

    await this.saveLaunchTcmConfigs(this.zbrLaunchId);
  }

  private async rerunResolver(suite: PwSuite) {
    try {
      if (!process.env.REPORTING_RUN_CONTEXT) {
        return suite;
      }

      const launchContext = JSON.parse(process.env.REPORTING_RUN_CONTEXT);
      this.exchangedLaunchContext = await this.apiClient.exchangeLaunchContext(launchContext);

      if (this.exchangedLaunchContext.mode === 'NEW' || !this.exchangedLaunchContext.runOnlySpecificTests) {
        return suite;
      }

      if (!this.exchangedLaunchContext.runAllowed) {
        throw new Error(`${this.exchangedLaunchContext.reason}`);
      }

      recursiveTestsTraversal(suite, this.exchangedLaunchContext);

      return suite;
    } catch (error) {
      this.logError('rerunResolver', error);
    }
  }

  async onTestBegin(pwTest: ExtendedPwTestCase, pwTestResult: PwTestResult) {
    const fullTestName = `${pwTest._projectId ? `${pwTest._projectId} > ` : ''}${getFullSuiteName(pwTest)} > ${
      pwTest.title
    }`;
    console.log(`${pwTestResult.retry > 0 ? 'Restarted' : 'Started'} test "${fullTestName}".`);

    if (!this.reportingConfig.enabled) {
      return;
    }

    pwTest.artifactReferences = [];
    pwTest.customArtifacts = [];
    pwTest.labels = getTestLabelsFromTitle(pwTest.title) || [];

    await until(() => !!this.zbrLaunchId); // zebrunner launch initialized
    if (pwTestResult.retry > 0) {
      this.totalTestCount += 1;
      await until(() => pwTestResult.retry - this.pwTestIdToZbrFinishedTry.get(pwTest.id) === 1); // previous test try finished
    }

    const testStartedAt = new Date(pwTestResult.startTime);

    const zbrTestId =
      pwTestResult.retry > 0 && this.pwTestIdToZbrTestId.has(pwTest.id) // test restarted and not reverted in Zebrunner
        ? await this.restartTestAndGetId(this.zbrLaunchId, pwTest, testStartedAt)
        : await this.startTestAndGetId(this.zbrLaunchId, pwTest, testStartedAt);
    // [OLD] Needed for rerun?: this.exchangedLaunchContext?.mode === 'RERUN'

    this.pwTestIdToZbrTestId.set(pwTest.id, zbrTestId);
    this.pwTestIdToZbrStartedTry.set(pwTest.id, pwTestResult.retry);
  }

  onStdOut(chunk: string, pwTest: ExtendedPwTestCase, pwTestResult: PwTestResult) {
    // onStdOut must NOT be async function because it must always finish before onTestEnd

    if (!this.reportingConfig.enabled) {
      return;
    }

    if (!isJsonString(chunk)) {
      // handle console.log's from tests source code
      console.log(chunk.trim());
      if (pwTest && !this.reportingConfig.logs.ignoreConsole) {
        const prevStep = pwTestResult.steps[pwTestResult.steps.length - 1];
        pwTestResult.steps.push(
          createPwStepObject(prevStep.startTime.getTime(), `console.log('${chunk.trim()}');`, 'log:INFO'),
        );
      }
      return;
    }

    const { eventType, payload } = JSON.parse(chunk);

    if (eventType === EVENT_NAMES.LOG_ERROR) {
      this.logError(payload.stage, payload.message);
    }

    // handle actions related to launch:
    if (eventType === EVENT_NAMES.ATTACH_LAUNCH_LABELS) {
      this.zbrLaunchLabels.push(...payload.values.map((value: string) => ({ key: payload.key, value })));
    } else if (eventType === EVENT_NAMES.ATTACH_LAUNCH_ARTIFACT_REFERENCES) {
      const index = this.zbrLaunchArtifactReferences.findIndex((ar) => ar.name === payload.name);
      if (index === -1) {
        this.zbrLaunchArtifactReferences.push({ name: payload.name, value: payload.value });
      } else {
        this.zbrLaunchArtifactReferences[index].value = payload.value;
      }
    } else if (eventType === EVENT_NAMES.ATTACH_LAUNCH_ARTIFACT) {
      // do not add duplicate file since pw could execute it's methods containing attachArtifact() call multiple times
      this.zbrLaunchArtifacts = this.zbrLaunchArtifacts
        .filter((a) => JSON.stringify(a.pathOrBuffer) !== JSON.stringify(payload.pathOrBuffer))
        .concat([getCustomArtifactObject(payload)]);
    }

    // handle actions related to test:
    if (!pwTest) return;
    const prevStepTimestamp = pwTestResult.steps[pwTestResult.steps.length - 1].startTime.getTime();

    if (eventType === EVENT_NAMES.ATTACH_TEST_CASE) {
      this.addTestCase(pwTest, payload);
    } else if (eventType === EVENT_NAMES.ATTACH_TEST_MAINTAINER) {
      pwTest.maintainer = payload;
    } else if (eventType === EVENT_NAMES.ATTACH_TEST_LOG) {
      if (!this.reportingConfig.logs.ignoreCustom) {
        pwTestResult.steps.push(createPwStepObject(prevStepTimestamp, payload.message, `log:${payload.level}`));
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
    } else if (eventType === EVENT_NAMES.ATTACH_TEST_SCREENSHOT) {
      if (!this.reportingConfig.logs.ignoreManualScreenshots) {
        pwTestResult.steps.push(
          createPwStepObject(
            prevStepTimestamp,
            'currentTest.attachScreenshot()',
            'screenshot',
            payload.pathOrBuffer.type === 'Buffer' ? Buffer.from(payload.pathOrBuffer) : payload.pathOrBuffer,
          ),
        );
      }
    } else if (eventType === EVENT_NAMES.ATTACH_TEST_ARTIFACT) {
      pwTest.customArtifacts.push(getCustomArtifactObject(payload));
    }
  }

  async onTestEnd(pwTest: ExtendedPwTestCase, pwTestResult: PwTestResult) {
    const fullTestName = `${pwTest._projectId ? `${pwTest._projectId} > ` : ''}${getFullSuiteName(pwTest)} > ${
      pwTest.title
    }`;
    console.log(`Finished test "${fullTestName}": ${pwTestResult.status}.`);

    if (!this.reportingConfig.enabled) {
      return;
    }

    await until(() => this.pwTestIdToZbrStartedTry.get(pwTest.id) === pwTestResult.retry); // zebrunner test started/restarted

    const zbrTestId = this.pwTestIdToZbrTestId.get(pwTest.id);

    if (pwTest.shouldBeReverted) {
      await this.revertTestRegistration(this.zbrLaunchId, zbrTestId);
      this.pwTestIdToZbrTestId.delete(pwTest.id);
    } else {
      await this.attachTestLabels(this.zbrLaunchId, zbrTestId, pwTest.labels);
      await this.attachTestLogs(
        this.zbrLaunchId,
        getTestLogs(
          pwTestResult.steps,
          zbrTestId,
          this.reportingConfig.logs.ignorePlaywrightSteps,
          this.reportingConfig.logs.useLinesFromSourceCode,
        ),
      );
      await this.attachTestMaintainer(this.zbrLaunchId, zbrTestId, pwTest.maintainer);
      await this.attachTestCases(this.zbrLaunchId, zbrTestId, pwTest.testCases, pwTestResult.status);
      const testAttachments = await processAttachments(pwTestResult.attachments);
      await this.attachTestFiles(this.zbrLaunchId, zbrTestId, [...testAttachments.files, ...pwTest.customArtifacts]);
      await this.attachTestArtifactReferences(this.zbrLaunchId, zbrTestId, pwTest.artifactReferences);
      if (!this.reportingConfig.logs.ignoreAutoScreenshots) {
        await this.attachTestScreenshots(this.zbrLaunchId, zbrTestId, testAttachments.screenshots);
      }

      if (testAttachments.videos.length) {
        const sessionStartedAt = new Date(pwTestResult.startTime);
        const zbrSessionId = await this.startTestSessionAndGetId(this.zbrLaunchId, zbrTestId, pwTest, sessionStartedAt);
        const sessionEndedAt = new Date();
        await this.finishTestSession(this.zbrLaunchId, zbrSessionId, sessionEndedAt);
        await this.attachSessionVideos(this.zbrLaunchId, zbrSessionId, testAttachments.videos);
      }

      await this.finishTest(this.zbrLaunchId, zbrTestId, pwTestResult);

      console.log(`Finished uploading test "${fullTestName}" data to Zebrunner.`);
    }

    this.pwTestIdToZbrFinishedTry.set(pwTest.id, pwTestResult.retry);
  }

  async onEnd() {
    if (!this.reportingConfig.enabled) {
      console.log('All tests finished.');
      return;
    }

    await until(() => getFinishedTestCount(this.pwTestIdToZbrFinishedTry) === this.totalTestCount); // all zebrunner tests finished (including retries)

    await this.attachLaunchArtifactReferences(this.zbrLaunchId, this.zbrLaunchArtifactReferences);
    await this.attachLaunchLabels(this.zbrLaunchId, this.zbrLaunchLabels);
    await this.attachLaunchFiles(this.zbrLaunchId, this.zbrLaunchArtifacts);

    const launchEndedAt = new Date();
    await this.finishLaunch(this.zbrLaunchId, launchEndedAt);
    console.log(
      `Zebrunner agent finished work${
        this.errors.size ? `ing with errors in the following stage(s): ${getErrorsStringFromMap(this.errors)}` : ''
      }.`,
    );
  }

  private async startLaunchAndGetId(startedAt: Date): Promise<number> {
    try {
      const launchUuid = this.exchangedLaunchContext ? this.exchangedLaunchContext.launchUuid : null;
      const request = new StartLaunchRequest(launchUuid, startedAt, this.reportingConfig);
      const zbrLaunchId = await this.apiClient.startLaunch(this.reportingConfig.projectKey, request);

      return zbrLaunchId;
    } catch (error) {
      this.logError('startLaunchAndGetId', error);
    }
  }

  private async attachTestMaintainer(zbrLaunchId: number, zbrTestId: number, maintainer: string) {
    try {
      if (maintainer) {
        await this.apiClient.updateTest(zbrLaunchId, zbrTestId, { maintainer });
      }
    } catch (error) {
      this.logError('attachTestMaintainer', error);
    }
  }

  private async saveLaunchTcmConfigs(zbrLaunchId: number): Promise<void> {
    try {
      const request = new UpdateTcmConfigsRequest(this.reportingConfig);

      if (request.hasAnyValue) {
        await this.apiClient.updateTcmConfigs(zbrLaunchId, request);
      }
    } catch (error) {
      this.logError('saveLaunchTcmConfigs', error);
    }
  }

  private async startTestAndGetId(zbrLaunchId: number, pwTest: ExtendedPwTestCase, testStartedAt: Date) {
    try {
      const fullSuiteName = getFullSuiteName(pwTest);
      const browserCapabilities = parseBrowserCapabilities(pwTest.parent.project());

      const zbrTestId = await this.apiClient.startTest(zbrLaunchId, {
        name: `${pwTest._projectId ? `${pwTest._projectId} > ` : ''}${fullSuiteName} > ${pwTest.title}`,
        className: fullSuiteName,
        methodName: `${pwTest._projectId ? `${pwTest._projectId} > ` : ''}${fullSuiteName} > ${pwTest.title}`,
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

  private async restartTestAndGetId(zbrLaunchId: number, pwTest: ExtendedPwTestCase, testStartedAt: Date) {
    try {
      const fullSuiteName = getFullSuiteName(pwTest);
      const browserCapabilities = parseBrowserCapabilities(pwTest.parent.project());

      /* [OLD] Needed for rerun?:
      const testToRerun = this.exchangedLaunchContext.testsToRun.filter(
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
      */

      const zbrTestId = await this.apiClient.restartTest(zbrLaunchId, this.pwTestIdToZbrTestId.get(pwTest.id), {
        name: `${pwTest._projectId ? `${pwTest._projectId} > ` : ''}${fullSuiteName} > ${pwTest.title}`,
        className: fullSuiteName,
        methodName: `${pwTest._projectId ? `${pwTest._projectId} > ` : ''}${fullSuiteName} > ${pwTest.title}`,
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

  private addTestCase(pwTest: ExtendedPwTestCase, newTestCase: ZbrTestCase) {
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
    zbrLaunchId: number,
    zbrTestId: number,
    pwTest: ExtendedPwTestCase,
    testStartedAt: Date,
  ) {
    try {
      const browserCapabilities = parseBrowserCapabilities(pwTest.parent.project());
      const sessionId = await this.apiClient.startTestSession(zbrLaunchId, {
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

  private async attachTestCases(
    zbrLaunchId: number,
    zbrTestId: number,
    testCases: ZbrTestCase[],
    pwTestStatus: string,
  ): Promise<void> {
    try {
      if (isNotEmptyArray(testCases)) {
        const testCasesWithStatuses = testCases.map((testCase) => {
          if (!testCase.resultStatus) {
            if (pwTestStatus === 'passed') {
              testCase.resultStatus = this.reportingConfig.tcm.testCaseStatus.onPass;
            } else if (pwTestStatus === 'failed') {
              testCase.resultStatus = this.reportingConfig.tcm.testCaseStatus.onFail;
            } else if (pwTestStatus === 'skipped') {
              testCase.resultStatus = this.reportingConfig.tcm.testCaseStatus.onSkip;
            }
          }

          return testCase;
        });

        await this.apiClient.upsertTestTestCases(zbrLaunchId, zbrTestId, { items: testCasesWithStatuses });
      }
    } catch (error) {
      this.logError('attachTestCases', error);
    }
  }

  private async attachTestLabels(zbrLaunchId: number, zbrTestId: number, labels: { key: string; value: string }[]) {
    try {
      await this.apiClient.attachTestLabels(zbrLaunchId, zbrTestId, { items: labels });
    } catch (error) {
      this.logError('attachTestLabels', error);
    }
  }

  private async attachTestScreenshots(zbrLaunchId: number, zbrTestId: number, screenshots: FileArtifact[]) {
    try {
      if (!screenshots.length) return;

      const screenshotsPromises = screenshots.map((screenshot) => {
        const file = Buffer.isBuffer(screenshot.pathOrBuffer)
          ? screenshot.pathOrBuffer
          : fs.readFileSync(screenshot.pathOrBuffer);

        return this.apiClient.uploadTestScreenshot(zbrLaunchId, zbrTestId, file, screenshot.timestamp);
      });

      await Promise.all(screenshotsPromises);
    } catch (error) {
      this.logError('attachTestScreenshots', error);
    }
  }

  private async attachTestFiles(
    zbrLaunchId?: number,
    zbrTestId?: number,
    files?: FileArtifact[],
  ): Promise<AxiosResponse> {
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

        return this.apiClient.uploadTestArtifact(
          zbrLaunchId,
          zbrTestId,
          formData.getHeaders()['content-type'],
          formData,
        );
      });

      await Promise.all(filePromises);
    } catch (error) {
      this.logError('attachTestFiles', error);
    }
  }

  private async attachSessionVideos(zbrLaunchId: number, zbrSessionId: number, videos: FileArtifact[]) {
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
          zbrLaunchId,
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

  private async attachLaunchFiles(zbrLaunchId?: number, files?: FileArtifact[]) {
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

        return this.apiClient.uploadLaunchArtifact(zbrLaunchId, formData.getHeaders()['content-type'], formData);
      });

      await Promise.all(filePromises);
    } catch (error) {
      this.logError('attachLaunchFiles', error);
    }
  }

  private async finishTestSession(zbrLaunchId: number, zbrTestSessionId: number, testEndedAt: Date) {
    try {
      await this.apiClient.finishTestSession(zbrLaunchId, zbrTestSessionId, { endedAt: testEndedAt });
    } catch (error) {
      this.logError('finishTestSession', error);
    }
  }

  private async finishTest(zbrLaunchId: number, zbrTestId: number, pwTestResult: PwTestResult) {
    try {
      const startedAt = new Date(pwTestResult.startTime);
      let endedAt = new Date(startedAt.getTime() + pwTestResult.duration);

      if (startedAt.getTime() === endedAt.getTime()) {
        endedAt = new Date(endedAt.getTime() + 1);
      }

      await this.apiClient.finishTest(zbrLaunchId, zbrTestId, {
        result: determineStatus(pwTestResult.status),
        reason: `${cleanseReason(pwTestResult.error?.message)} \n ${cleanseReason(pwTestResult.error?.stack)}`,
        endedAt,
      });
    } catch (error) {
      this.logError('finishTest', error);
    }
  }

  private async attachTestLogs(zbrLaunchId: number, zbrLogEntries: TestLog[]) {
    try {
      if (!zbrLogEntries.length) {
        return;
      }

      for (const log of zbrLogEntries) {
        if (log.type === 'screenshot') {
          await this.attachTestScreenshots(zbrLaunchId, log.testId, [
            { timestamp: log.timestamp, pathOrBuffer: log.screenshotPathOrBuffer },
          ]);
        } else {
          await this.apiClient.sendLogs(zbrLaunchId, [log]);
        }
      }
    } catch (error) {
      this.logError('attachTestLogs', error);
    }
  }

  private async finishLaunch(zbrLaunchId: number, launchEndedAt: Date): Promise<void> {
    try {
      await this.apiClient.finishLaunch(zbrLaunchId, { endedAt: launchEndedAt });
    } catch (error) {
      this.logError('finishLaunch', error);
    }
  }

  private async attachLaunchLabels(zbrLaunchId: number, labels: { key: string; value: string }[]) {
    try {
      await this.apiClient.attachLaunchLabels(zbrLaunchId, { items: labels });
    } catch (error) {
      this.logError('attachLaunchLabels', error);
    }
  }

  private async attachLaunchArtifactReferences(
    zbrLaunchId: number,
    artifactReferences: { name: string; value: string }[],
  ) {
    try {
      await this.apiClient.attachLaunchArtifactReferences(zbrLaunchId, { items: artifactReferences });
    } catch (error) {
      this.logError('attachLaunchArtifactReferences', error);
    }
  }

  private async attachTestArtifactReferences(
    zbrLaunchId: number,
    zbrTestId: number,
    artifactReferences: { name: string; value: string }[],
  ) {
    try {
      await this.apiClient.attachTestArtifactReferences(zbrLaunchId, zbrTestId, { items: artifactReferences });
    } catch (error) {
      this.logError('attachTestArtifactReferences', error);
    }
  }

  private async revertTestRegistration(zbrLaunchId: number, zbrTestId: number) {
    try {
      await this.apiClient.revertTestRegistration(zbrLaunchId, zbrTestId);
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
