import { ReporterDescription as PwReporterDescription } from '@playwright/test';
import {
  FullConfig as PwFullConfig,
  FullResult as PwFullResult,
  Reporter as PwReporter,
  Suite as PwSuite,
  TestResult as PwTestResult,
} from '@playwright/test/reporter';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import { AxiosResponse } from 'axios';
import FormData from 'form-data';
import { ZebrunnerApiClient } from './ZebrunnerApiClient';
import { EVENT_NAMES } from './constants/events';
import { ReportingConfig } from './ReportingConfig';
import { ExchangedLaunchContext } from './ZebrunnerApiClient/types/ExchangedLaunchContext';
import { StartLaunchRequest } from './ZebrunnerApiClient/types/StartLaunchRequest';
import { UpdateTcmConfigsRequest } from './ZebrunnerApiClient/types/UpdateTcmConfigsRequest';
import { ZbrTestCase, TestLog, TestLogOptions, ExtendedPwTestCase, FileArtifact, StructuredAction } from './types';
import { Labels, isProviderSessionLabel } from './constants/labels';
import {
  buildTestIdentity,
  cleanseReason,
  stripTerminalCodes,
  determineStatus,
  determineLogLevel,
  formatFailureReason,
  getFileSizeInBytes,
  getTestLogs,
  getTestLabelsFromTitle,
  normalizeAttemptLabels,
  parseBrowserCapabilities,
  prepareAttemptArtifacts,
  processAttachments,
  until,
  isNotEmptyArray,
  recursiveTestsTraversal,
  parseReporterEvent,
  getErrorsStringFromMap,
  getCustomArtifactObject,
  createPwStepObject,
  isNotBlankString,
  getFinishedTestCount,
} from './helpers';
import { materializeStdoutArtifact } from './helpers/materializeStdoutArtifact';

const ZBR_COLOR = !!process.stdout.isTTY && !process.env.NO_COLOR;
const ZBR_VERBOSE = /^(1|true|yes|on)$/i.test(process.env.ZBR_LOG_VERBOSE || '');
// stdout lines with this prefix are shown in the run output but not attached as Zebrunner test logs
const ZBR_CONSOLE_ONLY_PREFIX = process.env.ZBR_CONSOLE_ONLY_PREFIX || 'reporting-agent:';

const paint = (code: string, s: string) => (ZBR_COLOR ? `\x1b[${code}m${s}\x1b[0m` : s);
const dim = (s: string) => paint('2', s);
const red = (s: string) => paint('31', s);
const green = (s: string) => paint('32', s);
const yellow = (s: string) => paint('33', s);
const cyan = (s: string) => paint('36', s);
const gray = (s: string) => paint('90', s);

const ZBR_TAG = `${dim('[')}${cyan('zebrunner')}${dim(']')}`;

const zinfo = (msg: string) => console.log(`${ZBR_TAG} ${msg}`);
const zwarn = (msg: string) => console.log(`${ZBR_TAG} ${yellow('!')} ${msg}`);
const zerror = (msg: string) => console.log(`${ZBR_TAG} ${red('ERROR')} ${msg}`);

// Forward the artifact's own contentType so text logs keep charset=utf-8 instead of
// falling back to form-data's extension-based type (bare text/plain), which mojibakes UTF-8.
const buildAppendOptions = (file: FileArtifact, isBuffer: boolean): FormData.AppendOptions => {
  const filename = file.name ? file.name : isBuffer ? `file_${new Date(file.timestamp).toISOString()}` : undefined;
  const options: FormData.AppendOptions = {};
  if (filename) options.filename = filename;
  if (file.contentType) options.contentType = file.contentType;
  return options;
};

const removeTemporaryArtifacts = async (files: FileArtifact[]) => {
  await Promise.all(
    files
      .filter((file) => file.deleteAfterUpload && typeof file.pathOrBuffer === 'string')
      .map((file) => fs.promises.rm(file.pathOrBuffer as string, { force: true }).catch(() => undefined)),
  );
};

const isSerializedBuffer = (value: unknown): value is { type: 'Buffer'; data: number[] } =>
  !!value &&
  typeof value === 'object' &&
  (value as { type?: string }).type === 'Buffer' &&
  Array.isArray((value as { data?: unknown }).data);

const screenshotArtifactFromPayload = (payload: {
  pathOrBuffer?: unknown;
  timestamp?: unknown;
  deleteAfterUpload?: boolean;
}): FileArtifact => {
  const timestamp =
    typeof payload.timestamp === 'number' && Number.isFinite(payload.timestamp) ? payload.timestamp : Date.now();
  const raw = payload.pathOrBuffer;
  if (Buffer.isBuffer(raw)) {
    const materialized = materializeStdoutArtifact(raw, undefined, '.png');
    return { timestamp, pathOrBuffer: materialized.pathOrBuffer, deleteAfterUpload: true };
  }
  if (isSerializedBuffer(raw)) {
    const materialized = materializeStdoutArtifact(Buffer.from(raw.data), undefined, '.png');
    return { timestamp, pathOrBuffer: materialized.pathOrBuffer, deleteAfterUpload: true };
  }
  return {
    timestamp,
    pathOrBuffer: raw as string | Buffer,
    deleteAfterUpload: payload.deleteAfterUpload,
  };
};

const clearStepScreenshot = (pwTestResult: PwTestResult, screenshot: FileArtifact): void => {
  if (!Array.isArray(pwTestResult?.steps)) return;
  for (const step of pwTestResult.steps) {
    if (!step || !('screenshotPathOrBuffer' in step)) continue;
    const screenshotStep = step as { screenshotPathOrBuffer?: string | Buffer };
    if (screenshotStep.screenshotPathOrBuffer === screenshot.pathOrBuffer) {
      screenshotStep.screenshotPathOrBuffer = undefined;
    }
  }
};

const STATUS_STYLE: Record<string, { label: string; color: (s: string) => string }> = {
  passed: { label: '[PASS]', color: green },
  failed: { label: '[FAIL]', color: red },
  timedOut: { label: '[TIMEOUT]', color: red },
  interrupted: { label: '[INTERRUPTED]', color: yellow },
  skipped: { label: '[SKIP]', color: gray },
};

const isStructuredAction = (value: unknown): value is StructuredAction => {
  const action = value as StructuredAction;
  return (
    !!action &&
    typeof action.id === 'string' &&
    typeof action.method === 'string' &&
    Number.isFinite(action.startedAt) &&
    (action.status === 'started' ||
      ((action.status === 'passed' || action.status === 'failed') &&
        typeof action.endedAt === 'number' &&
        Number.isFinite(action.endedAt) &&
        action.endedAt >= action.startedAt))
  );
};

type SessionCapabilities = {
  browserName?: string;
  browserVersion?: string;
  platformName?: string;
  platformVersion?: string;
  deviceName?: string;
  'zebrunner:provider'?: string;
};

const isOrchestratorConfigured = (): boolean =>
  Boolean(
    isNotBlankString(process.env.PWM_ORCHESTRATOR) ||
      isNotBlankString(process.env.IOS_WS_ENDPOINT) ||
      isNotBlankString(process.env.ANDROID_WS_ENDPOINT),
  );

const resolveSessionProvider = (overrideCapabilities?: SessionCapabilities): string | undefined => {
  const fromCaps = overrideCapabilities?.['zebrunner:provider']?.trim();
  if (fromCaps) {
    return fromCaps;
  }

  const fromEnv = process.env.ZEBRUNNER_TESTING_PLATFORM?.trim();
  if (fromEnv) {
    return fromEnv;
  }

  // Redundant: ESG does not inject PLAYWRIGHT_WS_ENDPOINT, and the URL host is not inspected.
  if (isNotBlankString(process.env.PLAYWRIGHT_WS_ENDPOINT)) {
    return 'ZEBRUNNER';
  }

  if (isOrchestratorConfigured()) {
    return 'ZEBRUNNER_DEVICE_FARM';
  }

  return undefined;
};

type PwTestAttemptState = {
  attempt: number;
  startedAt: Date;
  endedAt?: Date;
  actions: StructuredAction[];
  maintainer?: string;
  testCases: ZbrTestCase[];
  labels: { key: string; value: string }[];
  shouldBeReverted: boolean;
  artifactReferences: { name: string; value: string }[];
  customArtifacts: FileArtifact[];
  customVideos: FileArtifact[];
  videoCapabilities?: SessionCapabilities;
  providerSessionId?: string;
  sentLogKeys: Set<string>;
  flushTimer?: ReturnType<typeof setInterval>;
  flushPromise?: Promise<void>;
  flushing: boolean;
  zbrSessionId?: number;
  sessionStartPromise?: Promise<void>;
  pendingScreenshots: FileArtifact[];
  screenshotUpload: Promise<void>;
};

const formatDuration = (ms: number): string => {
  if (!ms || ms < 0) return '0ms';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
};

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
  private pwTestResultToState = new Map<PwTestResult, PwTestAttemptState>();
  // Last known session capabilities per test, kept across retries so a try that dies
  // before reporting them (e.g. page-creation timeout) still shows Browser/Platform.
  private pwTestIdToCapabilities: Map<string, SessionCapabilities>;

  private exchangedLaunchContext: ExchangedLaunchContext;

  private launchFinished = false;
  private abortHandlersRegistered = false;
  private activeTestSessionIds: Set<number>;
  // This is also used when reporting is disabled. Initialize it before onBegin's
  // disabled fast path so the reporter remains a safe console-only reporter.
  private resultStats: Record<string, number> = {};
  private releasePlaywrightResults = false;

  async onBegin(config: PwFullConfig, suite: PwSuite) {
    if (!suite.allTests().length) {
      zwarn('No tests found.');
      process.exit();
    }

    const launchStartTime = new Date();

    const reporters: PwReporterDescription[] = config.reporter;
    const zebrunnerReporter: PwReporterDescription = reporters.find((reporterAndConfig) =>
      reporterAndConfig[0].includes('javascript-agent-playwright'),
    );
    this.releasePlaywrightResults = reporters.length === 1;

    this.reportingConfig = new ReportingConfig(zebrunnerReporter[1]);

    if (!this.reportingConfig.enabled) {
      zinfo(`${dim('disabled')} - skipping results upload.`);
      return;
    }

    this.zbrLaunchLabels = [];
    this.zbrLaunchArtifactReferences = [];
    this.zbrLaunchArtifacts = [];

    this.errors = new Map();

    this.pwTestIdToZbrTestId = new Map();
    this.pwTestIdToZbrStartedTry = new Map();
    this.pwTestIdToZbrFinishedTry = new Map();
    this.pwTestIdToCapabilities = new Map();
    this.activeTestSessionIds = new Set();
    this.resultStats = {};

    this.apiClient = new ZebrunnerApiClient(this.reportingConfig);
    suite = await this.rerunResolver(suite);
    this.totalTestCount = suite.allTests().length;

    this.zbrLaunchId = await this.startLaunchAndGetId(launchStartTime);

    zinfo(`launch ${cyan(`#${this.zbrLaunchId}`)} started - reporting ${this.totalTestCount} test(s).`);

    this.registerAbortHandlers();

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

  private getPwTestAttemptState(pwTest: ExtendedPwTestCase, pwTestResult: PwTestResult): PwTestAttemptState {
    const existingState = this.pwTestResultToState.get(pwTestResult);
    if (existingState) return existingState;

    const state: PwTestAttemptState = {
      attempt: pwTestResult.retry,
      startedAt: new Date(pwTestResult.startTime),
      actions: [],
      artifactReferences: [],
      customArtifacts: [],
      customVideos: [],
      labels: (getTestLabelsFromTitle(pwTest.title) || []).filter(
        (label): label is { key: string; value: string } => !!label,
      ),
      testCases: [],
      shouldBeReverted: false,
      sentLogKeys: new Set(),
      flushing: false,
      pendingScreenshots: [],
      screenshotUpload: Promise.resolve(),
    };
    this.pwTestResultToState.set(pwTestResult, state);
    return state;
  }

  private buildLogOptions(onlyCompletedSteps: boolean): TestLogOptions {
    const { logs } = this.reportingConfig;
    return {
      ignorePlaywrightSteps: logs.ignorePlaywrightSteps,
      includeHooks: logs.includeHooks,
      includeFixtures: logs.includeFixtures,
      includeBridgeActions: logs.includeBridgeActions,
      format: logs.format,
      includeDuration: logs.includeDuration,
      includeLocation: logs.includeLocation,
      maxSourceLines: logs.maxSourceLines,
      maxMessageLength: logs.maxMessageLength,
      onlyCompletedSteps,
    };
  }

  // Keys count repeats so identical entries in one render survive, while a re-render of the same
  // entry is dropped. Screenshots are never keyed: they upload during the test.
  private selectUnsentLogs(state: PwTestAttemptState, entries: TestLog[], claimedKeys?: string[]): TestLog[] {
    const occurrences = new Map<string, number>();
    return entries.filter((entry) => {
      if (entry.type !== 'log') {
        return true;
      }
      const base = `${entry.timestamp}|${entry.level}|${entry.message}`;
      const occurrence = (occurrences.get(base) || 0) + 1;
      occurrences.set(base, occurrence);
      const key = `${base}#${occurrence}`;
      if (state.sentLogKeys.has(key)) {
        return false;
      }
      state.sentLogKeys.add(key);
      claimedKeys?.push(key);
      return true;
    });
  }

  private attemptStartedLog(state: PwTestAttemptState, zbrTestId: number): TestLog {
    return {
      timestamp: state.startedAt.getTime(),
      message: `${state.attempt > 0 ? `Retry ${state.attempt}` : 'Attempt 1'} started`,
      level: 'INFO',
      testId: zbrTestId,
      type: 'log',
    };
  }

  private startLogFlush(pwTestResult: PwTestResult, state: PwTestAttemptState, zbrTestId: number) {
    const intervalMs = this.reportingConfig.logs.flushIntervalMs;
    if (!intervalMs || !zbrTestId || state.flushTimer) {
      return;
    }

    state.flushTimer = setInterval(() => {
      // Skipping while a flush runs keeps flushPromise pointing at the in-flight upload, not a no-op.
      if (state.flushing) return;
      state.flushPromise = this.flushTestLogs(pwTestResult, state, zbrTestId);
    }, intervalMs);
    state.flushTimer.unref?.();
  }

  // Zebrunner binds the provider session when reporting starts, so do not wait for test end.
  private startLiveTestSession(
    pwTest: ExtendedPwTestCase,
    pwTestResult: PwTestResult,
    state: PwTestAttemptState,
  ) {
    if (!this.reportingConfig.enabled || !this.pwTestIdToZbrTestId || state.sessionStartPromise || state.zbrSessionId) {
      return;
    }
    const providerSessionId = state.providerSessionId;
    if (!providerSessionId) {
      return;
    }

    state.sessionStartPromise = this.registerLiveTestSession(pwTest, pwTestResult, state, providerSessionId);
  }

  private async registerLiveTestSession(
    pwTest: ExtendedPwTestCase,
    pwTestResult: PwTestResult,
    state: PwTestAttemptState,
    providerSessionId: string,
  ) {
    try {
      const waitDeadline = Date.now() + 30_000;
      await until(
        () =>
          (!!this.zbrLaunchId && this.pwTestIdToZbrStartedTry?.get(pwTest.id) === pwTestResult.retry) ||
          Date.now() > waitDeadline,
      );
      const zbrTestId = this.pwTestIdToZbrTestId?.get(pwTest.id);
      if (!zbrTestId || state.zbrSessionId) {
        return;
      }
      const zbrSessionId = await this.startTestSessionAndGetId(
        this.zbrLaunchId,
        zbrTestId,
        pwTest,
        state.startedAt,
        providerSessionId,
        state.videoCapabilities,
      );
      if (zbrSessionId) {
        state.zbrSessionId = zbrSessionId;
      }
    } catch (error) {
      this.logError('startLiveTestSession', error);
    }
  }

  private stopLogFlush(state: PwTestAttemptState) {
    if (state.flushTimer) {
      clearInterval(state.flushTimer);
      state.flushTimer = undefined;
    }
  }

  // Uploads only finished steps/actions, so a message is never re-sent with a different duration.
  private async flushTestLogs(pwTestResult: PwTestResult, state: PwTestAttemptState, zbrTestId: number) {
    if (state.flushing) {
      return;
    }
    state.flushing = true;
    const claimedKeys: string[] = [];
    try {
      const entries = [
        this.attemptStartedLog(state, zbrTestId),
        ...getTestLogs(pwTestResult.steps, zbrTestId, this.buildLogOptions(true), state.actions),
      ].filter((entry) => entry.type === 'log');
      const pending = this.selectUnsentLogs(state, entries, claimedKeys);
      if (pending.length) {
        await this.apiClient.sendLogs(this.zbrLaunchId, pending);
      }
    } catch (error) {
      // Release the claim so a failed flush is retried by the end-of-test upload instead of lost.
      claimedKeys.forEach((key) => state.sentLogKeys.delete(key));
      this.logError('flushTestLogs', error);
    } finally {
      state.flushing = false;
    }
  }

  private willRetry(pwTest: ExtendedPwTestCase, pwTestResult: PwTestResult): boolean {
    const maxRetries = (pwTest as ExtendedPwTestCase & { retries?: number }).retries || 0;
    return pwTestResult.status !== pwTest.expectedStatus && pwTestResult.retry < maxRetries;
  }

  private markTimedOutOperationFailed(
    pwTestResult: PwTestResult,
    state: PwTestAttemptState,
    endedAt: Date,
  ): void {
    if (pwTestResult.status !== 'timedOut') return;

    const resultError = pwTestResult.errors?.[0] || pwTestResult.error;
    const reason = cleanseReason(resultError?.message || resultError?.value || '').trim();
    const timeoutError = reason
      ? `Test timed out while executing this action. ${reason}`
      : 'Test timed out while executing this action.';
    const pendingAction = state.actions
      .filter((action) => action.status === 'started')
      .sort((left, right) => right.startedAt - left.startedAt)[0];

    if (pendingAction) {
      Object.assign(pendingAction, {
        endedAt: Math.max(pendingAction.startedAt, endedAt.getTime()),
        status: 'failed',
        error: timeoutError,
      });
      return;
    }

    type MutableStep = PwTestResult['steps'][number] & {
      duration?: number;
      error?: { message?: string; stack?: string };
      steps?: MutableStep[];
    };
    const pendingSteps: MutableStep[] = [];
    const collectPendingSteps = (steps: MutableStep[]) => {
      for (const step of steps || []) {
        if (!(Number.isFinite(step.duration) && step.duration >= 0)) pendingSteps.push(step);
        collectPendingSteps(step.steps || []);
      }
    };
    collectPendingSteps(pwTestResult.steps as MutableStep[]);
    const pendingStep = pendingSteps.sort(
      (left, right) => right.startTime.getTime() - left.startTime.getTime(),
    )[0];
    if (!pendingStep) return;

    pendingStep.duration = Math.max(0, endedAt.getTime() - pendingStep.startTime.getTime());
    pendingStep.error = { ...pendingStep.error, message: timeoutError };
  }

  // Playwright retains every TestCase/TestResult for the whole run; drop large buffers once uploaded.
  private async releasePwTestBuffers(state: PwTestAttemptState, pwTestResult: PwTestResult) {
    this.stopLogFlush(state);
    if (state.screenshotUpload) {
      await state.screenshotUpload.catch(() => undefined);
    }
    state.sentLogKeys.clear();
    const screenshots: FileArtifact[] = [];
    if (Array.isArray(pwTestResult?.steps)) {
      for (const step of pwTestResult.steps) {
        if (step && 'screenshotPathOrBuffer' in step) {
          const screenshotStep = step as {
            screenshotPathOrBuffer?: string | Buffer;
            deleteAfterUpload?: boolean;
          };
          if (screenshotStep.screenshotPathOrBuffer) {
            screenshots.push({
              timestamp: step.startTime.getTime(),
              pathOrBuffer: screenshotStep.screenshotPathOrBuffer,
              deleteAfterUpload: screenshotStep.deleteAfterUpload,
            });
          }
          screenshotStep.screenshotPathOrBuffer = undefined;
        }
      }
    }
    await removeTemporaryArtifacts([
      ...state.customArtifacts,
      ...state.customVideos,
      ...screenshots,
      ...(state.pendingScreenshots || []),
    ]);
    if (state.pendingScreenshots) state.pendingScreenshots.length = 0;
    state.customArtifacts.length = 0;
    state.customVideos.length = 0;
    state.artifactReferences.length = 0;
    state.labels.length = 0;
    state.actions.length = 0;
    state.testCases.length = 0;
    state.videoCapabilities = undefined;
    state.providerSessionId = undefined;
    state.maintainer = undefined;
    if (this.releasePlaywrightResults) {
      pwTestResult.stdout.length = 0;
      pwTestResult.stderr.length = 0;
      pwTestResult.steps.length = 0;
      for (const attachment of pwTestResult.attachments) {
        attachment.body = undefined;
      }
    }
    this.pwTestResultToState.delete(pwTestResult);
  }

  async onTestBegin(pwTest: ExtendedPwTestCase, pwTestResult: PwTestResult) {
    const fullTestName = buildTestIdentity(pwTest).name;
    const startLabel = pwTestResult.retry > 0 ? gray(`[RETRY #${pwTestResult.retry}]`) : gray('[START]');
    zinfo(`${startLabel} ${fullTestName}`);

    if (!this.reportingConfig.enabled) {
      return;
    }

    this.getPwTestAttemptState(pwTest, pwTestResult);

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

    this.startLogFlush(pwTestResult, this.getPwTestAttemptState(pwTest, pwTestResult), zbrTestId);
    this.enqueueScreenshotUpload(pwTest, pwTestResult, this.getPwTestAttemptState(pwTest, pwTestResult));
  }

  onStdOut(chunk: string, pwTest: ExtendedPwTestCase, pwTestResult: PwTestResult) {
    const rawChunk = String(chunk);
    const stdoutChunks = rawChunk.includes('\n') ? rawChunk.split(/\r?\n/).filter((line) => line.length) : [rawChunk];
    for (const stdoutChunk of stdoutChunks) {
      this.handleStdOutChunk(stdoutChunk, pwTest, pwTestResult);
    }
  }

  private handleStdOutChunk(chunk: string, pwTest: ExtendedPwTestCase, pwTestResult: PwTestResult) {
    // onStdOut must NOT be async function because it must always finish before onTestEnd

    if (!this.reportingConfig.enabled) {
      return;
    }

    const reporterEvent = parseReporterEvent(chunk);
    if (!reporterEvent) {
      // handle console.log's from tests source code
      const trimmed = chunk.trim();
      console.log(trimmed);
      const message = stripTerminalCodes(trimmed).trim();
      const isConsoleOnly = !!ZBR_CONSOLE_ONLY_PREFIX && message.startsWith(ZBR_CONSOLE_ONLY_PREFIX);
      if (pwTest && message && !this.reportingConfig.logs.ignoreConsole && !isConsoleOnly) {
        pwTestResult.steps.push(createPwStepObject(Date.now(), message, 'log:INFO'));
      }
      return;
    }

    const { eventType, payload } = reporterEvent;

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
      const artifact = getCustomArtifactObject(payload);
      const duplicateIndex = this.zbrLaunchArtifacts.findIndex((existing) =>
        artifact.fingerprint
          ? existing.fingerprint === artifact.fingerprint
          : JSON.stringify(existing.pathOrBuffer) === JSON.stringify(artifact.pathOrBuffer),
      );
      if (duplicateIndex === -1) {
        this.zbrLaunchArtifacts.push(artifact);
      } else {
        const replaced = this.zbrLaunchArtifacts.splice(duplicateIndex, 1, artifact)[0];
        if (replaced.deleteAfterUpload && typeof replaced.pathOrBuffer === 'string') {
          fs.rm(replaced.pathOrBuffer, { force: true }, () => {});
        }
      }
    }

    // handle actions related to test:
    if (!pwTest) return;
    const state = this.getPwTestAttemptState(pwTest, pwTestResult);
    const eventTimestamp = (value: unknown): number =>
      typeof value === 'number' && Number.isFinite(value) ? value : Date.now();

    if (eventType === EVENT_NAMES.ATTACH_TEST_CASE) {
      this.addTestCase(state, payload);
    } else if (eventType === EVENT_NAMES.ATTACH_TEST_MAINTAINER) {
      state.maintainer = payload;
    } else if (eventType === EVENT_NAMES.ATTACH_TEST_ACTION) {
      if (isStructuredAction(payload)) {
        const existingIndex = state.actions.findIndex((action) => action.id === payload.id);
        if (existingIndex >= 0) {
          state.actions[existingIndex] = { ...state.actions[existingIndex], ...payload };
        } else {
          state.actions.push(payload);
        }
      } else {
        this.logError('attachTestAction', 'Invalid structured action payload');
      }
    } else if (eventType === EVENT_NAMES.ATTACH_TEST_LOG) {
      if (!this.reportingConfig.logs.ignoreCustom) {
        pwTestResult.steps.push(
          createPwStepObject(eventTimestamp(payload.timestamp), payload.message, `log:${payload.level}`),
        );
      }
    } else if (eventType === EVENT_NAMES.ATTACH_TEST_ARTIFACT_REFERENCES) {
      const index = state.artifactReferences.findIndex((ar) => ar.name === payload.name);
      if (index === -1) {
        state.artifactReferences.push({ name: payload.name, value: payload.value });
      } else {
        state.artifactReferences[index].value = payload.value;
      }
    } else if (eventType === EVENT_NAMES.ATTACH_TEST_LABELS) {
      if (isProviderSessionLabel(payload.key)) {
        const value = payload.values?.[payload.values.length - 1];
        if (value) state.providerSessionId = value;
      } else {
        state.labels.push(...payload.values.map((value: string) => ({ key: payload.key, value })));
      }
    } else if (eventType === EVENT_NAMES.REVERT_TEST_REGISTRATION) {
      state.shouldBeReverted = true;
    } else if (eventType === EVENT_NAMES.ATTACH_TEST_SCREENSHOT) {
      if (this.reportingConfig.logs.ignoreManualScreenshots) {
        if (payload.deleteAfterUpload && typeof payload.pathOrBuffer === 'string') {
          fs.rm(payload.pathOrBuffer, { force: true }, () => {});
        }
      } else {
        const artifact = screenshotArtifactFromPayload(payload);
        if (!state.pendingScreenshots) state.pendingScreenshots = [];
        state.pendingScreenshots.push(artifact);
        pwTestResult.steps.push(
          createPwStepObject(
            artifact.timestamp,
            'currentTest.attachScreenshot()',
            'screenshot',
            artifact.pathOrBuffer,
            artifact.deleteAfterUpload,
          ),
        );
        this.enqueueScreenshotUpload(pwTest, pwTestResult, state);
      }
    } else if (eventType === EVENT_NAMES.ATTACH_TEST_ARTIFACT) {
      state.customArtifacts.push(getCustomArtifactObject(payload));
    } else if (eventType === EVENT_NAMES.ATTACH_TEST_VIDEO) {
      state.customVideos.push(getCustomArtifactObject(payload));
    } else if (eventType === EVENT_NAMES.ATTACH_TEST_SESSION_CAPABILITIES) {
      if (payload.capabilities) {
        state.videoCapabilities = payload.capabilities;
        this.pwTestIdToCapabilities.set(pwTest.id, payload.capabilities);
      }
      if (payload.sessionId) {
        state.providerSessionId = payload.sessionId;
      }
      this.startLiveTestSession(pwTest, pwTestResult, state);
    }
  }

  async onTestEnd(pwTest: ExtendedPwTestCase, pwTestResult: PwTestResult) {
    const state = this.getPwTestAttemptState(pwTest, pwTestResult);
    state.endedAt = new Date();
    this.stopLogFlush(state);
    try {
      await this.reportTestEnd(pwTest, pwTestResult, state);
    } catch (error) {
      // Reporting is best-effort: a failed upload must not escape to unhandledRejection and abort the run.
      this.logError('onTestEnd', error);
    } finally {
      if (this.reportingConfig.enabled) {
        this.pwTestIdToZbrFinishedTry.set(pwTest.id, pwTestResult.retry);
      }
      await this.releasePwTestBuffers(state, pwTestResult);
    }
  }

  private async reportTestEnd(
    pwTest: ExtendedPwTestCase,
    pwTestResult: PwTestResult,
    state: PwTestAttemptState,
  ) {
    const fullTestName = buildTestIdentity(pwTest).name;
    const style = STATUS_STYLE[pwTestResult.status] || {
      label: `[${String(pwTestResult.status).toUpperCase()}]`,
      color: gray,
    };
    const resultLabel = `${style.color(style.label)} ${dim(`(${formatDuration(pwTestResult.duration)})`)}`;
    const willRetry = this.willRetry(pwTest, pwTestResult);
    const prefixAttemptArtifacts = state.attempt > 0 || willRetry;
    this.resultStats[pwTestResult.status] = (this.resultStats[pwTestResult.status] || 0) + 1;

    // Printed before any upload so the console reports when the test ended, not when it was uploaded.
    const isReverted = this.reportingConfig.enabled && state.shouldBeReverted;
    zinfo(isReverted ? `${gray('[REVERTED]')} ${fullTestName}` : `${resultLabel} ${fullTestName}`);
    if (!isReverted) {
      this.logTestErrors(pwTestResult);
    }

    if (!this.reportingConfig.enabled) {
      return;
    }

    const uploadStartedAt = Date.now();
    // An in-flight flush owns part of sentLogKeys; the final upload must see it settled.
    if (state.flushPromise) {
      await state.flushPromise;
      state.flushPromise = undefined;
    }
    if (state.sessionStartPromise) {
      await state.sessionStartPromise;
      state.sessionStartPromise = undefined;
    }

    await until(() => this.pwTestIdToZbrStartedTry.get(pwTest.id) === pwTestResult.retry); // zebrunner test started/restarted

    const zbrTestId = this.pwTestIdToZbrTestId.get(pwTest.id);

    if (!state.shouldBeReverted) {
      this.enqueueScreenshotUpload(pwTest, pwTestResult, state);
      if (state.screenshotUpload) {
        await state.screenshotUpload;
      }
    }

    if (state.shouldBeReverted) {
      if (zbrTestId !== undefined) {
        await this.revertTestRegistration(this.zbrLaunchId, zbrTestId);
        this.pwTestIdToZbrTestId.delete(pwTest.id);
      }
    } else {
      // A retry that died early may never report its caps; inherit the last known
      // ones for this test so Browser/Platform stay populated instead of "n/a".
      if (!state.videoCapabilities && this.pwTestIdToCapabilities.has(pwTest.id)) {
        state.videoCapabilities = this.pwTestIdToCapabilities.get(pwTest.id);
      }

      const attemptName = state.attempt > 0 ? `Retry ${state.attempt}` : 'Attempt 1';
      const attemptEndedAt = state.endedAt || new Date();
      const sessionEndedAt = attemptEndedAt;
      this.markTimedOutOperationFailed(pwTestResult, state, attemptEndedAt);
      let auxiliaryError: unknown;
      try {
        const labels = normalizeAttemptLabels(state.labels, state.attempt);
        await this.attachTestLabels(this.zbrLaunchId, zbrTestId, labels);
        const logEntries = this.selectUnsentLogs(state, [
          this.attemptStartedLog(state, zbrTestId),
          ...getTestLogs(pwTestResult.steps, zbrTestId, this.buildLogOptions(false), state.actions),
          {
            timestamp: attemptEndedAt.getTime(),
            message: `${attemptName} finished: ${pwTestResult.status} (${formatDuration(pwTestResult.duration)})`,
            level: determineLogLevel(pwTestResult.status),
            testId: zbrTestId,
            type: 'log',
          },
        ]);
        await this.attachTestLogs(this.zbrLaunchId, logEntries);
        await this.attachTestMaintainer(this.zbrLaunchId, zbrTestId, state.maintainer);
        await this.attachTestCases(this.zbrLaunchId, zbrTestId, state.testCases, pwTestResult.status);
        const testAttachments = await processAttachments(pwTestResult.attachments);
        const providerSessionId = state.providerSessionId;
        const testFiles = prepareAttemptArtifacts(
          [...testAttachments.files, ...state.customArtifacts],
          state.attempt,
          prefixAttemptArtifacts,
        );
        await this.attachTestFiles(this.zbrLaunchId, zbrTestId, testFiles);
        const artifactReferences = state.artifactReferences.map((reference) =>
          prefixAttemptArtifacts
            ? { ...reference, name: `attempt-${state.attempt + 1}-${reference.name}` }
            : reference,
        );
        await this.attachTestArtifactReferences(this.zbrLaunchId, zbrTestId, artifactReferences);
        if (!this.reportingConfig.logs.ignoreAutoScreenshots) {
          await this.attachTestScreenshots(this.zbrLaunchId, zbrTestId, testAttachments.screenshots);
        }

        const sessionStartedAt = state.startedAt;
        const sessionVideos = [...testAttachments.videos, ...state.customVideos];
        let zbrSessionId = state.zbrSessionId;
        if (!zbrSessionId && (sessionVideos.length || providerSessionId || state.videoCapabilities)) {
          zbrSessionId = await this.startTestSessionAndGetId(
            this.zbrLaunchId,
            zbrTestId,
            pwTest,
            sessionStartedAt,
            providerSessionId,
            state.videoCapabilities,
          );
        }
        if (zbrSessionId) {
          await this.finishTestSession(this.zbrLaunchId, zbrSessionId, sessionEndedAt);
          if (sessionVideos.length) {
            await this.attachSessionVideos(this.zbrLaunchId, zbrSessionId, sessionVideos);
          }
        }
      } catch (error) {
        auxiliaryError = error;
      } finally {
        await this.finishTest(this.zbrLaunchId, zbrTestId, pwTestResult, sessionEndedAt);
      }
      if (auxiliaryError) throw auxiliaryError;

      if (ZBR_VERBOSE) {
        zinfo(dim(`uploaded ${fullTestName} (${formatDuration(Date.now() - uploadStartedAt)})`));
      }
    }
  }

  async onEnd(result?: PwFullResult) {
    if (!this.reportingConfig.enabled) {
      zinfo(`all tests finished. ${this.formatResultSummary()}`);
      return;
    }

    if (result?.status === 'interrupted') {
      zwarn('run interrupted - finishing launch with the results reported so far.');
    } else {
      // all zebrunner tests finished (including retries), bounded so an interrupted/stuck test cannot hang the launch
      const finishWaitTimeoutMs = parseInt(process.env.ZBR_FINISH_WAIT_TIMEOUT_MS, 10) || 60000;
      const waitStartedAt = Date.now();
      await until(
        () =>
          getFinishedTestCount(this.pwTestIdToZbrFinishedTry) === this.totalTestCount ||
          Date.now() - waitStartedAt > finishWaitTimeoutMs,
      );
    }

    await this.finishLaunchSafely();
  }

  private async finishActiveTestSessions(endedAt: Date = new Date()): Promise<void> {
    if (!this.activeTestSessionIds?.size) {
      return;
    }

    const sessionIds = Array.from(this.activeTestSessionIds);
    await Promise.all(sessionIds.map((sessionId) => this.finishTestSession(this.zbrLaunchId, sessionId, endedAt)));
  }

  private async finishLaunchSafely(launchEndedAt: Date = new Date()): Promise<void> {
    if (this.launchFinished || !this.zbrLaunchId) {
      return;
    }
    this.launchFinished = true;

    await this.finishActiveTestSessions(launchEndedAt);

    await this.attachLaunchArtifactReferences(this.zbrLaunchId, this.zbrLaunchArtifactReferences);
    await this.attachLaunchLabels(this.zbrLaunchId, this.zbrLaunchLabels);
    await this.attachLaunchFiles(this.zbrLaunchId, this.zbrLaunchArtifacts);

    await this.finishLaunch(this.zbrLaunchId, launchEndedAt);

    zinfo(`launch ${cyan(`#${this.zbrLaunchId}`)} finished. ${this.formatResultSummary()}`);
    if (this.errors.size) {
      zwarn(`completed with errors in stage(s): ${getErrorsStringFromMap(this.errors)}`);
    }
  }

  // Surface the test's own failure reason in the console (Playwright-style),
  // since this agent is often the only reporter configured.
  private logTestErrors(pwTestResult: PwTestResult) {
    if (pwTestResult.status === 'passed' || pwTestResult.status === 'skipped') {
      return;
    }

    const errors = pwTestResult.errors?.length
      ? pwTestResult.errors
      : pwTestResult.error
      ? [pwTestResult.error]
      : [];

    for (const error of errors) {
      const text = cleanseReason(error?.message || error?.value || error?.stack || '').trim();
      if (!text) continue;

      const lines = text.split('\n');
      const maxLines = ZBR_VERBOSE ? lines.length : Math.min(lines.length, 12);
      for (let i = 0; i < maxLines; i += 1) {
        console.log(`    ${dim('|')} ${i === 0 ? red(lines[i]) : gray(lines[i])}`);
      }
      if (maxLines < lines.length) {
        console.log(
          `    ${dim('|')} ${dim(`... ${lines.length - maxLines} more line(s); set ZBR_LOG_VERBOSE=1 for full output`)}`,
        );
      }
    }
  }

  private formatResultSummary(): string {
    const order = ['passed', 'failed', 'timedOut', 'interrupted', 'skipped'];
    const parts = order
      .filter((status) => this.resultStats[status])
      .map((status) => {
        const style = STATUS_STYLE[status] || { color: gray };
        return style.color(`${this.resultStats[status]} ${status}`);
      });
    return parts.length ? `(${parts.join(dim(', '))})` : dim('(no results)');
  }

  // SIGTERM/SIGHUP and crashes skip onEnd, leaving the Zebrunner launch open forever.
  // SIGINT (Ctrl+C) is intentionally NOT handled here: Playwright catches it and awaits onEnd,
  // so finishing there guarantees the request completes; a parallel handler would race and exit mid-request.
  private registerAbortHandlers() {
    if (this.abortHandlersRegistered || !this.reportingConfig?.enabled) {
      return;
    }
    this.abortHandlersRegistered = true;

    const finishOnAbort = async (reason: string, exitCode: number) => {
      try {
        if (this.zbrLaunchId && !this.launchFinished) {
          this.launchFinished = true;
          zwarn(`${reason} detected - finishing launch ${cyan(`#${this.zbrLaunchId}`)} on Zebrunner.`);
          const abortTimeoutMs = parseInt(process.env.ZBR_ABORT_FINISH_TIMEOUT_MS, 10) || 10000;
          const endedAt = new Date();
          await Promise.race([
            this.finishActiveTestSessions(endedAt).then(() => this.finishLaunch(this.zbrLaunchId, endedAt)),
            new Promise((resolve) => setTimeout(resolve, abortTimeoutMs)),
          ]);
        }
      } catch (error) {
        this.logError('finishOnAbort', error);
      } finally {
        process.exit(exitCode);
      }
    };

    process.once('SIGTERM', () => finishOnAbort('SIGTERM', 143));
    process.once('SIGHUP', () => finishOnAbort('SIGHUP', 129));
    process.once('uncaughtException', (error) => {
      this.logError('uncaughtException', error);
      finishOnAbort('uncaught exception', 1);
    });
    process.once('unhandledRejection', (reason) => {
      this.logError('unhandledRejection', reason);
      finishOnAbort('unhandled rejection', 1);
    });
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
      const identity = buildTestIdentity(pwTest);
      const browserCapabilities = parseBrowserCapabilities(pwTest.parent.project());

      const zbrTestId = await this.apiClient.startTest(zbrLaunchId, {
        name: identity.name,
        className: identity.className,
        methodName: identity.methodName,
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
      const identity = buildTestIdentity(pwTest);
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
        name: identity.name,
        className: identity.className,
        methodName: identity.methodName,
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

  private addTestCase(state: PwTestAttemptState, newTestCase: ZbrTestCase) {
    if (isNotEmptyArray(state.testCases)) {
      state.testCases = state.testCases.filter(
        (testCase: ZbrTestCase) =>
          testCase.tcmType !== newTestCase.tcmType || testCase.testCaseId !== newTestCase.testCaseId,
      );

      state.testCases.push(newTestCase);
    } else {
      state.testCases = [newTestCase];
    }
  }

  private async startTestSessionAndGetId(
    zbrLaunchId: number,
    zbrTestId: number,
    pwTest: ExtendedPwTestCase,
    testStartedAt: Date,
    providerSessionId?: string,
    overrideCapabilities?: SessionCapabilities,
  ) {
    try {
      const browserCapabilities = parseBrowserCapabilities(pwTest.parent.project());
      const browserVersion = overrideCapabilities?.browserVersion || browserCapabilities.browser.version;
      const platformVersion = overrideCapabilities?.platformVersion || browserCapabilities.os.version;
      const capabilities: SessionCapabilities & {
        browserName: string;
        platformName: string;
      } = {
        browserName: overrideCapabilities?.browserName || browserCapabilities.browser.name || 'n/a',
        platformName: overrideCapabilities?.platformName || browserCapabilities.os.name || 'n/a',
      };
      if (browserVersion) {
        capabilities.browserVersion = browserVersion;
      }
      if (platformVersion) {
        capabilities.platformVersion = platformVersion;
      }
      if (overrideCapabilities?.deviceName) {
        capabilities.deviceName = overrideCapabilities.deviceName;
      }
      const provider = resolveSessionProvider(overrideCapabilities);
      if (provider) {
        capabilities['zebrunner:provider'] = provider;
      }
      const sessionId = await this.apiClient.startTestSession(zbrLaunchId, {
        sessionId: providerSessionId || randomUUID(),
        initiatedAt: testStartedAt,
        startedAt: testStartedAt,
        desiredCapabilities: capabilities,
        capabilities,
        testIds: [zbrTestId],
      });

      if (sessionId) {
        this.activeTestSessionIds.add(sessionId);
      }

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
      throw error;
    }
  }

  private enqueueScreenshotUpload(
    pwTest: ExtendedPwTestCase,
    pwTestResult: PwTestResult,
    state: PwTestAttemptState,
  ): void {
    if (!this.zbrLaunchId || !this.pwTestIdToZbrTestId) return;
    const zbrTestId = this.pwTestIdToZbrTestId.get(pwTest.id);
    if (!zbrTestId) return;
    if (!state.pendingScreenshots) state.pendingScreenshots = [];
    state.screenshotUpload = Promise.resolve(state.screenshotUpload)
      .catch(() => undefined)
      .then(() => this.pumpPendingScreenshots(pwTestResult, state, zbrTestId));
  }

  private async pumpPendingScreenshots(
    pwTestResult: PwTestResult,
    state: PwTestAttemptState,
    zbrTestId: number,
  ): Promise<void> {
    while (state.pendingScreenshots?.length) {
      const screenshot = state.pendingScreenshots.shift();
      if (!screenshot) return;
      try {
        await this.attachTestScreenshots(this.zbrLaunchId, zbrTestId, [screenshot]);
        clearStepScreenshot(pwTestResult, screenshot);
      } catch (error) {
        this.logError('pumpPendingScreenshots', error);
      }
    }
  }

  private async attachTestScreenshots(zbrLaunchId: number, zbrTestId: number, screenshots: FileArtifact[]) {
    if (!screenshots.length) return;

    for (const screenshot of screenshots) {
      // An auto-capture can register a path whose file was never written (a closed or
      // backgrounded tab). Skip it instead of failing the upload with ENOENT.
      if (typeof screenshot.pathOrBuffer === 'string' && !fs.existsSync(screenshot.pathOrBuffer)) {
        continue;
      }
      try {
        await this.apiClient.uploadTestScreenshot(
          zbrLaunchId,
          zbrTestId,
          screenshot.pathOrBuffer,
          screenshot.timestamp,
        );
        if (screenshot.deleteAfterUpload && typeof screenshot.pathOrBuffer === 'string') {
          await fs.promises.rm(screenshot.pathOrBuffer, { force: true }).catch(() => undefined);
        }
      } catch (error) {
        // Screenshots are best-effort artifacts, so one failure must not abort finalization.
        this.logError('attachTestScreenshots', error);
      }
    }
  }

  private async attachTestFiles(
    zbrLaunchId?: number,
    zbrTestId?: number,
    files: FileArtifact[] = [],
  ): Promise<AxiosResponse> {
    if (!files.length) {
      return;
    }
    try {
      for (const file of files) {
        const formData = new FormData();
        const isBuffer = Buffer.isBuffer(file.pathOrBuffer);
        formData.append(
          'file',
          isBuffer ? file.pathOrBuffer : fs.createReadStream(file.pathOrBuffer),
          buildAppendOptions(file, isBuffer),
        );

        await this.apiClient.uploadTestArtifact(
          zbrLaunchId,
          zbrTestId,
          formData.getHeaders()['content-type'],
          formData,
        );
      }
    } catch (error) {
      this.logError('attachTestFiles', error);
      throw error;
    } finally {
      await removeTemporaryArtifacts(files);
    }
  }

  private async attachSessionVideos(zbrLaunchId: number, zbrSessionId: number, videos: FileArtifact[]) {
    try {
      if (!videos.length) {
        return;
      }

      for (const video of videos) {
        const formData = new FormData();
        const isBuffer = Buffer.isBuffer(video.pathOrBuffer);
        formData.append(
          'video',
          isBuffer ? video.pathOrBuffer : fs.createReadStream(video.pathOrBuffer),
          video.name ? video.name : isBuffer ? `video_${new Date(video.timestamp).toISOString()}` : null,
        );

        await this.apiClient.uploadSessionArtifact(
          zbrLaunchId,
          zbrSessionId,
          formData.getHeaders()['content-type'],
          getFileSizeInBytes(video.pathOrBuffer),
          formData,
        );
      }
    } catch (error) {
      this.logError('attachSessionVideos', error);
      throw error;
    } finally {
      await removeTemporaryArtifacts(videos);
    }
  }

  private async attachLaunchFiles(zbrLaunchId?: number, files: FileArtifact[] = []) {
    try {
      if (!files.length) {
        return;
      }

      for (const file of files) {
        const formData = new FormData();
        const isBuffer = Buffer.isBuffer(file.pathOrBuffer);
        formData.append(
          'file',
          isBuffer ? file.pathOrBuffer : fs.createReadStream(file.pathOrBuffer),
          buildAppendOptions(file, isBuffer),
        );

        await this.apiClient.uploadLaunchArtifact(zbrLaunchId, formData.getHeaders()['content-type'], formData);
      }
    } catch (error) {
      this.logError('attachLaunchFiles', error);
    } finally {
      await removeTemporaryArtifacts(files);
    }
  }

  private async finishTestSession(zbrLaunchId: number, zbrTestSessionId: number, testEndedAt: Date) {
    try {
      await this.apiClient.finishTestSession(zbrLaunchId, zbrTestSessionId, { endedAt: testEndedAt });
      this.activeTestSessionIds.delete(zbrTestSessionId);
    } catch (error) {
      this.logError('finishTestSession', error);
    }
  }

  private async finishTest(
    zbrLaunchId: number,
    zbrTestId: number,
    pwTestResult: PwTestResult,
    attemptEndedAt: Date,
  ) {
    try {
      const startedAt = new Date(pwTestResult.startTime);
      const endedAt =
        attemptEndedAt.getTime() > startedAt.getTime() ? attemptEndedAt : new Date(startedAt.getTime() + 1);

      await this.apiClient.finishTest(zbrLaunchId, zbrTestId, {
        result: determineStatus(pwTestResult.status),
        reason: formatFailureReason(pwTestResult.error),
        endedAt,
      });
    } catch (error) {
      this.logError('finishTest', error);
      throw error;
    }
  }

  private async attachTestLogs(zbrLaunchId: number, zbrLogEntries: TestLog[]) {
    try {
      if (!zbrLogEntries.length) {
        return;
      }

      const batchSize = 100;
      let batch: TestLog[] = [];
      const flushBatch = async () => {
        if (!batch.length) return;
        const logs = batch;
        batch = [];
        await this.apiClient.sendLogs(zbrLaunchId, logs);
      };
      for (const entry of zbrLogEntries) {
        if (entry.type === 'screenshot') {
          if (!entry.screenshotPathOrBuffer) continue;
          await flushBatch();
          await this.attachTestScreenshots(zbrLaunchId, entry.testId, [
            {
              timestamp: entry.timestamp,
              pathOrBuffer: entry.screenshotPathOrBuffer,
              deleteAfterUpload: entry.deleteAfterUpload,
            },
          ]);
        } else {
          batch.push(entry);
          if (batch.length === batchSize) await flushBatch();
        }
      }
      await flushBatch();
    } catch (error) {
      this.logError('attachTestLogs', error);
      throw error;
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
      throw error;
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
    if (!this.errors) {
      this.errors = new Map();
    }
    if (this.errors.has(errorStage)) {
      this.errors.set(errorStage, this.errors.get(errorStage) + 1);
    } else {
      this.errors.set(errorStage, 1);
    }
    const message = error instanceof Error ? error.message : String(error);
    zerror(`${cyan(errorStage)}: ${message}`);
    if (ZBR_VERBOSE && error instanceof Error && error.stack) {
      console.log(gray(error.stack));
    }
  }
}

export default ZebrunnerReporter;
