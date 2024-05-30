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
const StartTestRunRequest_1 = require("./ZebrunnerApiClient/types/StartTestRunRequest");
const UpdateTcmConfigsRequest_1 = require("./ZebrunnerApiClient/types/UpdateTcmConfigsRequest");
const helpers_1 = require("./helpers");
class ZebrunnerReporter {
    reportingConfig;
    suite;
    apiClient;
    zbrTestRunId;
    zbrLogEntries;
    zbrRunLabels;
    zbrRunArtifactReferences;
    mapPwTestIdToZbrTestId;
    mapPwTestIdToZbrSessionId;
    mapPwTestIdToStatus;
    areAllTestsStarted;
    areAllTestsFinished;
    exchangedRunContext;
    async onBegin(config, suite) {
        const runStartTime = new Date();
        const reporters = config.reporter;
        const zebrunnerReporter = reporters.find((reporterAndConfig) => reporterAndConfig[0].includes('javascript-agent-playwright'));
        this.reportingConfig = new ReportingConfig_1.ReportingConfig(zebrunnerReporter[1]);
        if (!this.reportingConfig.enabled) {
            console.log('Zebrunner agent disabled - skipping results upload');
            return;
        }
        this.zbrLogEntries = [];
        this.zbrRunLabels = [];
        this.zbrRunArtifactReferences = [];
        this.mapPwTestIdToZbrTestId = new Map();
        this.mapPwTestIdToZbrSessionId = new Map();
        this.mapPwTestIdToStatus = new Map();
        this.suite = await this.rerunResolver(suite);
        this.apiClient = new ZebrunnerApiClient_1.ZebrunnerApiClient(this.reportingConfig);
        this.zbrTestRunId = await this.startTestRunAndGetId(runStartTime);
        await this.saveTestRunTcmConfigs(this.zbrTestRunId);
    }
    async rerunResolver(suite) {
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
            (0, helpers_1.recursiveTestsTraversal)(suite, this.exchangedRunContext);
            return suite;
        }
        catch (error) {
            console.log('Error during rerunResolver:', error);
        }
    }
    async onTestBegin(pwTest, pwTestResult) {
        const fullTestName = `${(0, helpers_1.getFullSuiteName)(pwTest)} > ${pwTest.title}`;
        console.log(`Started test "${fullTestName}"`);
        if (!this.reportingConfig.enabled) {
            return;
        }
        pwTest.labels = (0, helpers_1.getTestLabelsFromTitle)(pwTest.title) || [];
        pwTest.artifactReferences = [];
        pwTest.customLogs = [];
        await (0, helpers_1.waitUntil)(() => !!this.zbrTestRunId); // zebrunner run initialized
        const testStartedAt = new Date(pwTestResult.startTime);
        const zbrTestId = this.exchangedRunContext?.mode === 'RERUN'
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
    onStdOut(chunk, pwTest) {
        if (chunk.includes('connect') || chunk.includes('POST') || !this.reportingConfig.enabled) {
            return;
        }
        const { eventType, payload } = JSON.parse(chunk);
        if (eventType === events_1.EVENT_NAMES.ADD_TEST_CASE) {
            this.addZbrTestCase(pwTest, payload);
        }
        else if (eventType === events_1.EVENT_NAMES.SET_MAINTAINER) {
            pwTest.maintainer = payload;
        }
        else if (eventType === events_1.EVENT_NAMES.ADD_TEST_LOG) {
            pwTest.customLogs.push({ timestamp: new Date().getTime(), message: payload, level: 'INFO' });
        }
        else if (eventType === events_1.EVENT_NAMES.ATTACH_TEST_RUN_LABELS) {
            this.zbrRunLabels.push(...payload.values.map((value) => ({ key: payload.key, value })));
        }
        else if (eventType === events_1.EVENT_NAMES.ATTACH_TEST_RUN_ARTIFACT_REFERENCES) {
            const index = this.zbrRunArtifactReferences.findIndex((ar) => ar.name === payload.name);
            if (index === -1) {
                this.zbrRunArtifactReferences.push({ name: payload.name, value: payload.value });
            }
            else {
                this.zbrRunArtifactReferences[index].value = payload.value;
            }
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
    }
    async onTestEnd(pwTest, pwTestResult) {
        const fullTestName = `${(0, helpers_1.getFullSuiteName)(pwTest)} > ${pwTest.title}`;
        console.log(`Finished test "${fullTestName}": ${pwTestResult.status}`);
        if (!this.reportingConfig.enabled) {
            return;
        }
        await (0, helpers_1.waitUntil)(() => this.mapPwTestIdToZbrTestId.has(pwTest.id)); // zebrunner test initialized
        const zbrTestId = this.mapPwTestIdToZbrTestId.get(pwTest.id);
        if (pwTest.shouldBeReverted) {
            await this.revertTestRegistration(this.zbrTestRunId, zbrTestId);
            this.mapPwTestIdToStatus.set(pwTest.id, 'reverted');
        }
        else {
            const zbrSessionId = this.mapPwTestIdToZbrSessionId.get(pwTest.id);
            await this.saveZbrTestCases(this.zbrTestRunId, zbrTestId, pwTest.testCases);
            await this.addTestLabels(this.zbrTestRunId, zbrTestId, pwTest.labels);
            const testAttachments = (0, helpers_1.processAttachments)(pwTestResult.attachments);
            await this.addTestScreenshots(this.zbrTestRunId, zbrTestId, testAttachments.screenshots);
            await this.addTestFiles(this.zbrTestRunId, zbrTestId, testAttachments.files);
            await this.addTestArtifactReferences(this.zbrTestRunId, zbrTestId, pwTest.artifactReferences);
            this.zbrLogEntries.push(...(0, helpers_1.getTestSteps)(pwTestResult.steps, zbrTestId), ...pwTest.customLogs.map((log) => ({ ...log, testId: zbrTestId })));
            const testSessionEndedAt = new Date();
            await this.finishTestSession(this.zbrTestRunId, zbrSessionId, testSessionEndedAt);
            await this.addSessionVideos(this.zbrTestRunId, zbrSessionId, testAttachments.videos);
            await this.finishTest(this.zbrTestRunId, zbrTestId, pwTestResult);
            console.log(`Finished uploading test "${fullTestName}" data to Zebrunner`);
            this.mapPwTestIdToStatus.set(pwTest.id, 'finished');
        }
        await (0, helpers_1.waitUntil)(() => this.areAllTestsStarted);
        if (Array.from(this.mapPwTestIdToStatus.values()).every((status) => status === 'finished' || status === 'reverted')) {
            this.areAllTestsFinished = true;
        }
    }
    async onEnd() {
        console.log('Playwright test run finished');
        if (!this.reportingConfig.enabled) {
            return;
        }
        await (0, helpers_1.waitUntil)(() => this.areAllTestsFinished);
        await this.sendTestsSteps(this.zbrTestRunId, this.zbrLogEntries);
        await this.attachRunArtifactReferences(this.zbrTestRunId, this.zbrRunArtifactReferences);
        await this.attachRunLabels(this.zbrTestRunId, this.zbrRunLabels);
        const testRunEndedAt = new Date();
        await this.finishTestRun(this.zbrTestRunId, testRunEndedAt);
        console.log('Zebrunner agent finished work');
    }
    async startTestRunAndGetId(startedAt) {
        try {
            const runUuid = this.exchangedRunContext ? this.exchangedRunContext.testRunUuid : null;
            const request = new StartTestRunRequest_1.StartTestRunRequest(runUuid, startedAt, this.reportingConfig);
            const zbrTestRunId = await this.apiClient.startTestRun(this.reportingConfig.projectKey, request);
            return zbrTestRunId;
        }
        catch (error) {
            console.log('Error during startTestRunAndGetId:', error);
        }
    }
    async saveTestRunTcmConfigs(testRunId) {
        try {
            const request = new UpdateTcmConfigsRequest_1.UpdateTcmConfigsRequest(this.reportingConfig);
            if (request.hasAnyValue) {
                await this.apiClient.updateTcmConfigs(testRunId, request);
            }
        }
        catch (error) {
            console.log('Error during saveTcmConfigs:', error);
        }
    }
    async startTestAndGetId(zbrTestRunId, pwTest, testStartedAt) {
        try {
            const fullSuiteName = (0, helpers_1.getFullSuiteName)(pwTest);
            const browserCapabilities = (0, helpers_1.parseBrowserCapabilities)(pwTest.parent.project());
            const zbrTestId = await this.apiClient.startTest(zbrTestRunId, {
                name: `${fullSuiteName} > ${pwTest.title}`,
                className: fullSuiteName,
                methodName: `${fullSuiteName} > ${pwTest.title}`,
                maintainer: pwTest.maintainer || 'anonymous',
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
            console.log('Error during startTestAndGetId:', error);
        }
    }
    async restartTestAndGetId(zbrTestRunId, pwTest, testStartedAt) {
        try {
            console.log('restartTest'); // to remove
            const fullSuiteName = (0, helpers_1.getFullSuiteName)(pwTest);
            const browserCapabilities = (0, helpers_1.parseBrowserCapabilities)(pwTest.parent.project());
            const rerunTest = this.exchangedRunContext.testsToRun.filter((el) => {
                const { browser, version, os } = JSON.parse(el.correlationData);
                if (el.name === `${fullSuiteName} > ${pwTest.title}` &&
                    browser === browserCapabilities.browser.name &&
                    version === browserCapabilities.browser.version &&
                    os === browserCapabilities.os.name) {
                    return true;
                }
                return false;
            })[0];
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
        }
        catch (error) {
            console.log('Error during restartTestAndGetId:', error);
        }
    }
    addZbrTestCase(pwTest, newTestCase) {
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
    async startTestSessionAndGetId(zbrTestRunId, zbrTestId, pwTest, testStartedAt) {
        try {
            const browserCapabilities = (0, helpers_1.parseBrowserCapabilities)(pwTest.parent.project());
            const sessionId = await this.apiClient.startTestSession(zbrTestRunId, {
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
            console.log('Error during startTestSessionAndGetId:', error);
        }
    }
    async saveZbrTestCases(zbrTestRunId, zbrTestId, testCases) {
        try {
            if ((0, helpers_1.isNotEmptyArray)(testCases)) {
                await this.apiClient.upsertTestTestCases(zbrTestRunId, zbrTestId, { items: testCases });
            }
        }
        catch (error) {
            console.log('Error during saveZbrTestCases:', error);
        }
    }
    async addTestLabels(zbrTestRunId, zbrTestId, labels) {
        try {
            await this.apiClient.attachTestLabels(zbrTestRunId, zbrTestId, { items: labels });
        }
        catch (error) {
            console.log('Error during addTestTags:', error);
        }
    }
    async addTestScreenshots(zbrTestRunId, zbrTestId, screenshotsArray) {
        try {
            if (screenshotsArray.length === 0)
                return;
            const screenshotsPromises = screenshotsArray.map((screenshot) => {
                const file = fs.readFileSync(screenshot.path);
                return this.apiClient.uploadTestScreenshot(zbrTestRunId, zbrTestId, Buffer.from(file));
            });
            await Promise.all(screenshotsPromises);
        }
        catch (error) {
            console.log('Error during addTestScreenshots:', error);
        }
    }
    async addTestFiles(zbrTestRunId, zbrTestId, artifactsAttachments) {
        if (artifactsAttachments.length === 0) {
            return;
        }
        try {
            const artifactsPromises = artifactsAttachments.map((file) => {
                const formData = new form_data_1.default();
                formData.append('file', fs.createReadStream(file.path));
                return this.apiClient.uploadTestArtifact(zbrTestRunId, zbrTestId, formData.getHeaders()['content-type'], formData);
            });
            await Promise.all(artifactsPromises);
        }
        catch (error) {
            console.log('Error during addTestFiles:', error);
        }
    }
    async addSessionVideos(zbrTestRunId, zbrSessionId, videoPathsArray) {
        try {
            if (videoPathsArray.length === 0) {
                return;
            }
            const videoPromises = videoPathsArray.map((video) => {
                const formData = new form_data_1.default();
                formData.append('video', fs.createReadStream(video.path));
                return this.apiClient.uploadSessionArtifact(zbrTestRunId, zbrSessionId, formData.getHeaders()['content-type'], (0, helpers_1.getFileSizeInBytes)(video.path), formData);
            });
            await Promise.all(videoPromises);
        }
        catch (error) {
            console.log('Error during addSessionVideos:', error);
        }
    }
    async finishTestSession(zbrTestRunId, zbrTestSessionId, testEndedAt) {
        try {
            await this.apiClient.finishTestSession(zbrTestRunId, zbrTestSessionId, { endedAt: testEndedAt });
        }
        catch (error) {
            console.log('Error during finishTestSession:', error);
        }
    }
    async finishTest(zbrTestRunId, zbrTestId, pwTestResult) {
        try {
            const startedAt = new Date(pwTestResult.startTime);
            let endedAt = new Date(startedAt.getTime() + pwTestResult.duration);
            if (startedAt.getTime() === endedAt.getTime()) {
                endedAt = new Date(endedAt.getTime() + 1);
            }
            await this.apiClient.finishTest(zbrTestRunId, zbrTestId, {
                result: (0, helpers_1.determineStatus)(pwTestResult.status),
                reason: `${(0, helpers_1.cleanseReason)(pwTestResult.error?.message)} \n ${(0, helpers_1.cleanseReason)(pwTestResult.error?.stack)}`,
                endedAt,
            });
        }
        catch (error) {
            console.log('Error during finishTest:', error);
        }
    }
    async sendTestsSteps(zbrTestRunId, zbrLogEntries) {
        try {
            await this.apiClient.sendLogs(zbrTestRunId, zbrLogEntries);
        }
        catch (error) {
            console.log('Error during sendTestsSteps:', error);
        }
    }
    async finishTestRun(testRunId, testRunEndedAt) {
        try {
            await this.apiClient.finishTestRun(testRunId, { endedAt: testRunEndedAt });
        }
        catch (error) {
            console.log('Error during finishTestRun:', error);
        }
    }
    async attachRunLabels(zbrTestRunId, labels) {
        try {
            await this.apiClient.attachTestRunLabels(zbrTestRunId, { items: labels });
        }
        catch (error) {
            console.log('Error during attachRunLabels:', error);
        }
    }
    async attachRunArtifactReferences(zbrTestRunId, artifactReferences) {
        try {
            await this.apiClient.attachTestRunArtifactReferences(zbrTestRunId, { items: artifactReferences });
        }
        catch (error) {
            console.log('Error during attachRunArtifactReferences:', error);
        }
    }
    async addTestArtifactReferences(zbrTestRunId, zbrTestId, artifactReferences) {
        try {
            await this.apiClient.attachTestArtifactReferences(zbrTestRunId, zbrTestId, { items: artifactReferences });
        }
        catch (error) {
            console.log('Error during attachTestArtifactReferences:', error);
        }
    }
    async revertTestRegistration(zbrTestRunId, zbrTestId) {
        try {
            await this.apiClient.revertTestRegistration(zbrTestRunId, zbrTestId);
        }
        catch (error) {
            console.log('Error during revertTestRegistration:', error);
        }
    }
}
exports.default = ZebrunnerReporter;
//# sourceMappingURL=ZebrunnerReporter.js.map