"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const form_data_1 = __importDefault(require("form-data"));
const uuid_1 = require("uuid");
const ZebrunnerApiClient_1 = require("./ZebrunnerApiClient");
const events_1 = require("./constants/events");
const ReportingConfig_1 = require("./ReportingConfig");
const StartLaunchRequest_1 = require("./ZebrunnerApiClient/types/StartLaunchRequest");
const UpdateTcmConfigsRequest_1 = require("./ZebrunnerApiClient/types/UpdateTcmConfigsRequest");
const helpers_1 = require("./helpers");
class ZebrunnerReporter {
    reportingConfig;
    apiClient;
    zbrLaunchId;
    zbrLaunchLabels;
    zbrLaunchArtifactReferences;
    zbrLaunchArtifacts;
    errors;
    totalTestCount;
    mapPwTestIdToZbrTestId;
    mapPwTestIdToStatus;
    exchangedLaunchContext;
    async onBegin(config, suite) {
        if (!suite.allTests().length) {
            console.log('No tests found.');
            process.exit();
        }
        const launchStartTime = new Date();
        const reporters = config.reporter;
        const zebrunnerReporter = reporters.find((reporterAndConfig) => reporterAndConfig[0].includes('javascript-agent-playwright'));
        this.reportingConfig = new ReportingConfig_1.ReportingConfig(zebrunnerReporter[1]);
        if (!this.reportingConfig.enabled) {
            console.log('Zebrunner agent disabled - skipping results upload.');
            return;
        }
        this.zbrLaunchLabels = [];
        this.zbrLaunchArtifactReferences = [];
        this.zbrLaunchArtifacts = [];
        this.mapPwTestIdToZbrTestId = new Map();
        this.mapPwTestIdToStatus = new Map();
        this.errors = new Map();
        this.apiClient = new ZebrunnerApiClient_1.ZebrunnerApiClient(this.reportingConfig);
        suite = await this.rerunResolver(suite);
        this.totalTestCount = suite.allTests().length;
        this.zbrLaunchId = await this.startLaunchAndGetId(launchStartTime);
        await this.saveLaunchTcmConfigs(this.zbrLaunchId);
    }
    async rerunResolver(suite) {
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
            (0, helpers_1.recursiveTestsTraversal)(suite, this.exchangedLaunchContext);
            return suite;
        }
        catch (error) {
            this.logError('rerunResolver', error);
        }
    }
    async onTestBegin(pwTest, pwTestResult) {
        const fullTestName = `${(0, helpers_1.getFullSuiteName)(pwTest)} > ${pwTest.title}`;
        console.log(`Started test "${fullTestName}".`);
        if (!this.reportingConfig.enabled) {
            return;
        }
        pwTest.artifactReferences = [];
        pwTest.customArtifacts = [];
        pwTest.labels = (0, helpers_1.getTestLabelsFromTitle)(pwTest.title) || [];
        await (0, helpers_1.until)(() => !!this.zbrLaunchId); // zebrunner launch initialized
        const testStartedAt = new Date(pwTestResult.startTime);
        const zbrTestId = this.exchangedLaunchContext?.mode === 'RERUN'
            ? await this.restartTestAndGetId(this.zbrLaunchId, pwTest, testStartedAt)
            : await this.startTestAndGetId(this.zbrLaunchId, pwTest, testStartedAt);
        this.mapPwTestIdToZbrTestId.set(pwTest.id, zbrTestId);
        this.mapPwTestIdToStatus.set(pwTest.id, 'started');
    }
    onStdOut(chunk, pwTest, pwTestResult) {
        // onStdOut must NOT be async function because it must always finish before onTestEnd
        if (!this.reportingConfig.enabled) {
            return;
        }
        if (!(0, helpers_1.isJsonString)(chunk)) {
            // handle console.log's from tests source code
            console.log(chunk.trim());
            if (pwTest) {
                const prevStep = pwTestResult.steps[pwTestResult.steps.length - 1];
                pwTestResult.steps.push((0, helpers_1.createPwStepObject)(prevStep.startTime.getTime(), `console.log('${chunk.trim()}');`, 'log:INFO'));
            }
            return;
        }
        const { eventType, payload } = JSON.parse(chunk);
        if (eventType === events_1.EVENT_NAMES.LOG_ERROR) {
            this.logError(payload.stage, payload.message);
        }
        // handle actions related to launch:
        if (eventType === events_1.EVENT_NAMES.ATTACH_LAUNCH_LABELS) {
            this.zbrLaunchLabels.push(...payload.values.map((value) => ({ key: payload.key, value })));
        }
        else if (eventType === events_1.EVENT_NAMES.ATTACH_LAUNCH_ARTIFACT_REFERENCES) {
            const index = this.zbrLaunchArtifactReferences.findIndex((ar) => ar.name === payload.name);
            if (index === -1) {
                this.zbrLaunchArtifactReferences.push({ name: payload.name, value: payload.value });
            }
            else {
                this.zbrLaunchArtifactReferences[index].value = payload.value;
            }
        }
        else if (eventType === events_1.EVENT_NAMES.ATTACH_LAUNCH_ARTIFACT) {
            // do not add duplicate file since pw could execute it's methods containing attachArtifact() call multiple times
            this.zbrLaunchArtifacts = this.zbrLaunchArtifacts
                .filter((a) => JSON.stringify(a.pathOrBuffer) !== JSON.stringify(payload.pathOrBuffer))
                .concat([(0, helpers_1.getCustomArtifactObject)(payload)]);
        }
        // handle actions related to test:
        if (!pwTest)
            return;
        const prevStepTimestamp = pwTestResult.steps[pwTestResult.steps.length - 1].startTime.getTime();
        if (eventType === events_1.EVENT_NAMES.ATTACH_TEST_CASE) {
            this.addTestCase(pwTest, payload);
        }
        else if (eventType === events_1.EVENT_NAMES.ATTACH_TEST_MAINTAINER) {
            pwTest.maintainer = payload;
        }
        else if (eventType === events_1.EVENT_NAMES.ATTACH_TEST_LOG) {
            pwTestResult.steps.push((0, helpers_1.createPwStepObject)(prevStepTimestamp, payload.message, `log:${payload.level}`));
        }
        else if (eventType === events_1.EVENT_NAMES.ATTACH_TEST_ARTIFACT_REFERENCES) {
            const index = pwTest.artifactReferences.findIndex((ar) => ar.name === payload.name);
            if (index === -1) {
                pwTest.artifactReferences.push({ name: payload.name, value: payload.value });
            }
            else {
                pwTest.artifactReferences[index].value = payload.value;
            }
        }
        else if (eventType === events_1.EVENT_NAMES.ATTACH_TEST_LABELS) {
            pwTest.labels.push(...payload.values.map((value) => ({ key: payload.key, value })));
        }
        else if (eventType === events_1.EVENT_NAMES.REVERT_TEST_REGISTRATION) {
            pwTest.shouldBeReverted = true;
        }
        else if (eventType === events_1.EVENT_NAMES.ATTACH_TEST_SCREENSHOT) {
            pwTestResult.steps.push((0, helpers_1.createPwStepObject)(prevStepTimestamp, 'CurrentTest.attachScreenshot()', 'screenshot', payload.pathOrBuffer.type === 'Buffer' ? Buffer.from(payload.pathOrBuffer) : payload.pathOrBuffer));
        }
        else if (eventType === events_1.EVENT_NAMES.ATTACH_TEST_ARTIFACT) {
            pwTest.customArtifacts.push((0, helpers_1.getCustomArtifactObject)(payload));
        }
    }
    async onTestEnd(pwTest, pwTestResult) {
        const fullTestName = `${(0, helpers_1.getFullSuiteName)(pwTest)} > ${pwTest.title}`;
        console.log(`Finished test "${fullTestName}": ${pwTestResult.status}.`);
        if (!this.reportingConfig.enabled) {
            return;
        }
        await (0, helpers_1.until)(() => this.mapPwTestIdToStatus.get(pwTest.id) === 'started'); // zebrunner test initialized
        const zbrTestId = this.mapPwTestIdToZbrTestId.get(pwTest.id);
        if (pwTest.shouldBeReverted) {
            await this.revertTestRegistration(this.zbrLaunchId, zbrTestId);
            this.mapPwTestIdToStatus.set(pwTest.id, 'reverted');
        }
        else {
            await this.attachTestLabels(this.zbrLaunchId, zbrTestId, pwTest.labels);
            await this.attachTestLogs(this.zbrLaunchId, (0, helpers_1.getTestLogs)(pwTestResult.steps, zbrTestId));
            await this.attachTestMaintainer(this.zbrLaunchId, zbrTestId, pwTest.maintainer);
            await this.attachTestCases(this.zbrLaunchId, zbrTestId, pwTest.testCases, pwTestResult.status);
            const testAttachments = await (0, helpers_1.processAttachments)(pwTestResult.attachments);
            await this.attachTestFiles(this.zbrLaunchId, zbrTestId, [...testAttachments.files, ...pwTest.customArtifacts]);
            await this.attachTestArtifactReferences(this.zbrLaunchId, zbrTestId, pwTest.artifactReferences);
            await this.attachTestScreenshots(this.zbrLaunchId, zbrTestId, testAttachments.screenshots);
            if (testAttachments.videos.length) {
                const sessionStartedAt = new Date(pwTestResult.startTime);
                const zbrSessionId = await this.startTestSessionAndGetId(this.zbrLaunchId, zbrTestId, pwTest, sessionStartedAt);
                const sessionEndedAt = new Date();
                await this.finishTestSession(this.zbrLaunchId, zbrSessionId, sessionEndedAt);
                await this.attachSessionVideos(this.zbrLaunchId, zbrSessionId, testAttachments.videos);
            }
            await this.finishTest(this.zbrLaunchId, zbrTestId, pwTestResult);
            console.log(`Finished uploading test "${fullTestName}" data to Zebrunner.`);
            this.mapPwTestIdToStatus.set(pwTest.id, 'finished');
        }
    }
    async onEnd() {
        if (!this.reportingConfig.enabled) {
            console.log('All tests finished.');
            return;
        }
        await (0, helpers_1.until)(() => Array.from(this.mapPwTestIdToStatus.values()).every((status) => status === 'finished' || status === 'reverted') && this.mapPwTestIdToStatus.size === this.totalTestCount); // all zebrunner tests finished
        await this.attachLaunchArtifactReferences(this.zbrLaunchId, this.zbrLaunchArtifactReferences);
        await this.attachLaunchLabels(this.zbrLaunchId, this.zbrLaunchLabels);
        await this.attachLaunchFiles(this.zbrLaunchId, this.zbrLaunchArtifacts);
        const launchEndedAt = new Date();
        await this.finishLaunch(this.zbrLaunchId, launchEndedAt);
        console.log(`Zebrunner agent finished work${this.errors.size ? `ing with errors in the following stage(s): ${(0, helpers_1.getErrorsStringFromMap)(this.errors)}` : ''}.`);
    }
    async startLaunchAndGetId(startedAt) {
        try {
            const launchUuid = this.exchangedLaunchContext ? this.exchangedLaunchContext.launchUuid : null;
            const request = new StartLaunchRequest_1.StartLaunchRequest(launchUuid, startedAt, this.reportingConfig);
            const zbrLaunchId = await this.apiClient.startLaunch(this.reportingConfig.projectKey, request);
            return zbrLaunchId;
        }
        catch (error) {
            this.logError('startLaunchAndGetId', error);
        }
    }
    async attachTestMaintainer(zbrLaunchId, zbrTestId, maintainer) {
        try {
            if (maintainer) {
                await this.apiClient.updateTest(zbrLaunchId, zbrTestId, { maintainer });
            }
        }
        catch (error) {
            this.logError('attachTestMaintainer', error);
        }
    }
    async saveLaunchTcmConfigs(zbrLaunchId) {
        try {
            const request = new UpdateTcmConfigsRequest_1.UpdateTcmConfigsRequest(this.reportingConfig);
            if (request.hasAnyValue) {
                await this.apiClient.updateTcmConfigs(zbrLaunchId, request);
            }
        }
        catch (error) {
            this.logError('saveLaunchTcmConfigs', error);
        }
    }
    async startTestAndGetId(zbrLaunchId, pwTest, testStartedAt) {
        try {
            const fullSuiteName = (0, helpers_1.getFullSuiteName)(pwTest);
            const browserCapabilities = (0, helpers_1.parseBrowserCapabilities)(pwTest.parent.project());
            const zbrTestId = await this.apiClient.startTest(zbrLaunchId, {
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
        }
        catch (error) {
            this.logError('startTestAndGetId', error);
        }
    }
    async restartTestAndGetId(zbrLaunchId, pwTest, testStartedAt) {
        try {
            const fullSuiteName = (0, helpers_1.getFullSuiteName)(pwTest);
            const browserCapabilities = (0, helpers_1.parseBrowserCapabilities)(pwTest.parent.project());
            const testToRerun = this.exchangedLaunchContext.testsToRun.filter((el) => {
                const { browser, version, os } = JSON.parse(el.correlationData);
                if (el.name === `${fullSuiteName} > ${pwTest.title}` &&
                    browser === browserCapabilities.browser.name &&
                    version === browserCapabilities.browser.version &&
                    os === browserCapabilities.os.name) {
                    return true;
                }
                return false;
            })[0];
            const zbrTestId = await this.apiClient.restartTest(zbrLaunchId, testToRerun.id, {
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
        }
        catch (error) {
            this.logError('restartTestAndGetId', error);
        }
    }
    addTestCase(pwTest, newTestCase) {
        if ((0, helpers_1.isNotEmptyArray)(pwTest.testCases)) {
            pwTest.testCases = pwTest.testCases.filter((testCase) => 
            // not the same test case
            testCase.tcmType !== newTestCase.tcmType || testCase.testCaseId !== newTestCase.testCaseId);
            pwTest.testCases.push(newTestCase);
        }
        else {
            pwTest.testCases = [newTestCase];
        }
    }
    async startTestSessionAndGetId(zbrLaunchId, zbrTestId, pwTest, testStartedAt) {
        try {
            const browserCapabilities = (0, helpers_1.parseBrowserCapabilities)(pwTest.parent.project());
            const sessionId = await this.apiClient.startTestSession(zbrLaunchId, {
                sessionId: (0, uuid_1.v4)(),
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
        }
        catch (error) {
            this.logError('startTestSessionAndGetId', error);
        }
    }
    async attachTestCases(zbrLaunchId, zbrTestId, testCases, pwTestStatus) {
        try {
            if ((0, helpers_1.isNotEmptyArray)(testCases)) {
                const testCasesWithStatuses = testCases.map((testCase) => {
                    if (!testCase.resultStatus) {
                        if (pwTestStatus === 'passed') {
                            testCase.resultStatus = this.reportingConfig.tcm.testCaseStatus.onPass;
                        }
                        else if (pwTestStatus === 'failed') {
                            testCase.resultStatus = this.reportingConfig.tcm.testCaseStatus.onFail;
                        }
                        else if (pwTestStatus === 'skipped') {
                            testCase.resultStatus = this.reportingConfig.tcm.testCaseStatus.onSkip;
                        }
                    }
                    return testCase;
                });
                await this.apiClient.upsertTestTestCases(zbrLaunchId, zbrTestId, { items: testCasesWithStatuses });
            }
        }
        catch (error) {
            this.logError('attachTestCases', error);
        }
    }
    async attachTestLabels(zbrLaunchId, zbrTestId, labels) {
        try {
            await this.apiClient.attachTestLabels(zbrLaunchId, zbrTestId, { items: labels });
        }
        catch (error) {
            this.logError('attachTestLabels', error);
        }
    }
    async attachTestScreenshots(zbrLaunchId, zbrTestId, screenshots) {
        try {
            if (!screenshots.length)
                return;
            const screenshotsPromises = screenshots.map((screenshot) => {
                const file = Buffer.isBuffer(screenshot.pathOrBuffer)
                    ? screenshot.pathOrBuffer
                    : fs.readFileSync(screenshot.pathOrBuffer);
                return this.apiClient.uploadTestScreenshot(zbrLaunchId, zbrTestId, file, screenshot.timestamp);
            });
            await Promise.all(screenshotsPromises);
        }
        catch (error) {
            this.logError('attachTestScreenshots', error);
        }
    }
    async attachTestFiles(zbrLaunchId, zbrTestId, files) {
        if (!files.length) {
            return;
        }
        try {
            const filePromises = files.map((file) => {
                const formData = new form_data_1.default();
                const isBuffer = Buffer.isBuffer(file.pathOrBuffer);
                formData.append('file', isBuffer ? file.pathOrBuffer : fs.createReadStream(file.pathOrBuffer), file.name ? file.name : isBuffer ? `file_${new Date(file.timestamp).toISOString()}` : null);
                return this.apiClient.uploadTestArtifact(zbrLaunchId, zbrTestId, formData.getHeaders()['content-type'], formData);
            });
            await Promise.all(filePromises);
        }
        catch (error) {
            this.logError('attachTestFiles', error);
        }
    }
    async attachSessionVideos(zbrLaunchId, zbrSessionId, videos) {
        try {
            if (!videos.length) {
                return;
            }
            const videoPromises = videos.map((video) => {
                const formData = new form_data_1.default();
                const isBuffer = Buffer.isBuffer(video.pathOrBuffer);
                formData.append('video', isBuffer ? video.pathOrBuffer : fs.createReadStream(video.pathOrBuffer), video.name ? video.name : isBuffer ? `video_${new Date(video.timestamp).toISOString()}` : null);
                return this.apiClient.uploadSessionArtifact(zbrLaunchId, zbrSessionId, formData.getHeaders()['content-type'], (0, helpers_1.getFileSizeInBytes)(video.pathOrBuffer), formData);
            });
            await Promise.all(videoPromises);
        }
        catch (error) {
            this.logError('attachSessionVideos', error);
        }
    }
    async attachLaunchFiles(zbrLaunchId, files) {
        try {
            if (!files.length) {
                return;
            }
            const filePromises = files.map((file) => {
                const formData = new form_data_1.default();
                const isBuffer = Buffer.isBuffer(file.pathOrBuffer);
                formData.append('file', isBuffer ? file.pathOrBuffer : fs.createReadStream(file.pathOrBuffer), file.name ? file.name : isBuffer ? `file_${new Date(file.timestamp).toISOString()}` : null);
                return this.apiClient.uploadLaunchArtifact(zbrLaunchId, formData.getHeaders()['content-type'], formData);
            });
            await Promise.all(filePromises);
        }
        catch (error) {
            this.logError('attachLaunchFiles', error);
        }
    }
    async finishTestSession(zbrLaunchId, zbrTestSessionId, testEndedAt) {
        try {
            await this.apiClient.finishTestSession(zbrLaunchId, zbrTestSessionId, { endedAt: testEndedAt });
        }
        catch (error) {
            this.logError('finishTestSession', error);
        }
    }
    async finishTest(zbrLaunchId, zbrTestId, pwTestResult) {
        try {
            const startedAt = new Date(pwTestResult.startTime);
            let endedAt = new Date(startedAt.getTime() + pwTestResult.duration);
            if (startedAt.getTime() === endedAt.getTime()) {
                endedAt = new Date(endedAt.getTime() + 1);
            }
            await this.apiClient.finishTest(zbrLaunchId, zbrTestId, {
                result: (0, helpers_1.determineStatus)(pwTestResult.status),
                reason: `${(0, helpers_1.cleanseReason)(pwTestResult.error?.message)} \n ${(0, helpers_1.cleanseReason)(pwTestResult.error?.stack)}`,
                endedAt,
            });
        }
        catch (error) {
            this.logError('finishTest', error);
        }
    }
    async attachTestLogs(zbrLaunchId, zbrLogEntries) {
        try {
            for (const log of zbrLogEntries) {
                if (log.type === 'screenshot') {
                    await this.attachTestScreenshots(zbrLaunchId, log.testId, [
                        { timestamp: log.timestamp, pathOrBuffer: log.screenshotPathOrBuffer },
                    ]);
                }
                else {
                    await this.apiClient.sendLogs(zbrLaunchId, [log]);
                }
            }
        }
        catch (error) {
            this.logError('attachTestLogs', error);
        }
    }
    async finishLaunch(zbrLaunchId, launchEndedAt) {
        try {
            await this.apiClient.finishLaunch(zbrLaunchId, { endedAt: launchEndedAt });
        }
        catch (error) {
            this.logError('finishLaunch', error);
        }
    }
    async attachLaunchLabels(zbrLaunchId, labels) {
        try {
            await this.apiClient.attachLaunchLabels(zbrLaunchId, { items: labels });
        }
        catch (error) {
            this.logError('attachLaunchLabels', error);
        }
    }
    async attachLaunchArtifactReferences(zbrLaunchId, artifactReferences) {
        try {
            await this.apiClient.attachLaunchArtifactReferences(zbrLaunchId, { items: artifactReferences });
        }
        catch (error) {
            this.logError('attachLaunchArtifactReferences', error);
        }
    }
    async attachTestArtifactReferences(zbrLaunchId, zbrTestId, artifactReferences) {
        try {
            await this.apiClient.attachTestArtifactReferences(zbrLaunchId, zbrTestId, { items: artifactReferences });
        }
        catch (error) {
            this.logError('attachTestArtifactReferences', error);
        }
    }
    async revertTestRegistration(zbrLaunchId, zbrTestId) {
        try {
            await this.apiClient.revertTestRegistration(zbrLaunchId, zbrTestId);
        }
        catch (error) {
            this.logError('revertTestRegistration', error);
        }
    }
    logError(errorStage, error) {
        if (this.errors.has(errorStage)) {
            this.errors.set(errorStage, this.errors.get(errorStage) + 1);
        }
        else {
            this.errors.set(errorStage, 1);
        }
        console.log(`Error during ${errorStage}:`, error);
    }
}
exports.default = ZebrunnerReporter;
//# sourceMappingURL=ZebrunnerReporter.js.map