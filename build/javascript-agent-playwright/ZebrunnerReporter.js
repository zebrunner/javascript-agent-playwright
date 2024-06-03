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
    apiClient;
    zbrRunId;
    zbrRunLabels;
    zbrRunArtifactReferences;
    totalTestCount;
    mapPwTestIdToZbrTestId;
    mapPwTestIdToZbrSessionId;
    mapPwTestIdToStatus;
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
        this.zbrRunLabels = [];
        this.zbrRunArtifactReferences = [];
        this.mapPwTestIdToZbrTestId = new Map();
        this.mapPwTestIdToZbrSessionId = new Map();
        this.mapPwTestIdToStatus = new Map();
        this.apiClient = new ZebrunnerApiClient_1.ZebrunnerApiClient(this.reportingConfig);
        suite = await this.rerunResolver(suite);
        this.totalTestCount = suite.allTests().length;
        this.zbrRunId = await this.startTestRunAndGetId(runStartTime);
        await this.saveTestRunTcmConfigs(this.zbrRunId);
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
        await (0, helpers_1.until)(() => !!this.zbrRunId); // zebrunner run initialized
        const testStartedAt = new Date(pwTestResult.startTime);
        const zbrTestId = this.exchangedRunContext?.mode === 'RERUN'
            ? await this.restartTestAndGetId(this.zbrRunId, pwTest, testStartedAt)
            : await this.startTestAndGetId(this.zbrRunId, pwTest, testStartedAt);
        const zbrTestSessionId = await this.startTestSessionAndGetId(this.zbrRunId, zbrTestId, pwTest, testStartedAt);
        this.mapPwTestIdToZbrTestId.set(pwTest.id, zbrTestId);
        this.mapPwTestIdToZbrSessionId.set(pwTest.id, zbrTestSessionId);
        this.mapPwTestIdToStatus.set(pwTest.id, 'started');
    }
    onStdOut(chunk, pwTest) {
        // onStdOut must not be async function because it must always finish before onTestEnd
        if (chunk.includes('connect') || chunk.includes('POST') || !this.reportingConfig.enabled) {
            return;
        }
        if (!(0, helpers_1.isJsonString)(chunk)) {
            console.log(chunk.trim());
            pwTest?.customLogs.push({
                timestamp: new Date().getTime(),
                message: `console.log("${chunk.trim()}")`,
                level: 'INFO',
            });
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
            pwTest.customLogs.push({ timestamp: payload.timestamp, message: payload.message, level: 'INFO' });
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
        await (0, helpers_1.until)(() => this.mapPwTestIdToStatus.get(pwTest.id) === 'started'); // zebrunner test initialized
        const zbrTestId = this.mapPwTestIdToZbrTestId.get(pwTest.id);
        if (pwTest.shouldBeReverted) {
            await this.revertTestRegistration(this.zbrRunId, zbrTestId);
            this.mapPwTestIdToStatus.set(pwTest.id, 'reverted');
        }
        else {
            const zbrSessionId = this.mapPwTestIdToZbrSessionId.get(pwTest.id);
            await this.saveZbrTestCases(this.zbrRunId, zbrTestId, pwTest.testCases);
            await this.addTestMaintainer(this.zbrRunId, zbrTestId, pwTest.maintainer);
            await this.addTestLabels(this.zbrRunId, zbrTestId, pwTest.labels);
            const testAttachments = await (0, helpers_1.processAttachments)(pwTestResult.attachments);
            await this.addTestScreenshots(this.zbrRunId, zbrTestId, testAttachments.screenshots);
            await this.addTestFiles(this.zbrRunId, zbrTestId, testAttachments.files);
            await this.addTestArtifactReferences(this.zbrRunId, zbrTestId, pwTest.artifactReferences);
            await this.sendTestLogs(this.zbrRunId, [
                ...(0, helpers_1.getTestSteps)(pwTestResult.steps, zbrTestId),
                ...pwTest.customLogs.map((log) => ({ ...log, testId: zbrTestId })),
            ]);
            const testSessionEndedAt = new Date();
            await this.finishTestSession(this.zbrRunId, zbrSessionId, testSessionEndedAt);
            await this.addSessionVideos(this.zbrRunId, zbrSessionId, testAttachments.videos);
            await this.finishTest(this.zbrRunId, zbrTestId, pwTestResult, pwTest.maintainer);
            console.log(`Finished uploading test "${fullTestName}" data to Zebrunner`);
            this.mapPwTestIdToStatus.set(pwTest.id, 'finished');
        }
    }
    async onEnd() {
        if (!this.reportingConfig.enabled) {
            console.log('All tests finished');
            return;
        }
        await (0, helpers_1.until)(() => Array.from(this.mapPwTestIdToStatus.values()).every((status) => status === 'finished' || status === 'reverted') && this.mapPwTestIdToStatus.size === this.totalTestCount); // all zebrunner tests finished
        await this.attachRunArtifactReferences(this.zbrRunId, this.zbrRunArtifactReferences);
        await this.attachRunLabels(this.zbrRunId, this.zbrRunLabels);
        const testRunEndedAt = new Date();
        await this.finishTestRun(this.zbrRunId, testRunEndedAt);
        console.log('Zebrunner agent finished work');
    }
    async startTestRunAndGetId(startedAt) {
        try {
            const runUuid = this.exchangedRunContext ? this.exchangedRunContext.testRunUuid : null;
            const request = new StartTestRunRequest_1.StartTestRunRequest(runUuid, startedAt, this.reportingConfig);
            const zbrRunId = await this.apiClient.startTestRun(this.reportingConfig.projectKey, request);
            return zbrRunId;
        }
        catch (error) {
            console.log('Error during startTestRunAndGetId:', error);
        }
    }
    async addTestMaintainer(zbrRunId, zbrTestId, maintainer) {
        try {
            if (maintainer) {
                await this.apiClient.updateTest(zbrRunId, zbrTestId, { maintainer });
            }
        }
        catch (error) {
            console.log('Error during addTestMaintainer (updateTest):', error);
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
    async startTestAndGetId(zbrRunId, pwTest, testStartedAt) {
        try {
            const fullSuiteName = (0, helpers_1.getFullSuiteName)(pwTest);
            const browserCapabilities = (0, helpers_1.parseBrowserCapabilities)(pwTest.parent.project());
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
        }
        catch (error) {
            console.log('Error during startTestAndGetId:', error);
        }
    }
    async restartTestAndGetId(zbrRunId, pwTest, testStartedAt) {
        try {
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
    async startTestSessionAndGetId(zbrRunId, zbrTestId, pwTest, testStartedAt) {
        try {
            const browserCapabilities = (0, helpers_1.parseBrowserCapabilities)(pwTest.parent.project());
            const sessionId = await this.apiClient.startTestSession(zbrRunId, {
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
    async saveZbrTestCases(zbrRunId, zbrTestId, testCases) {
        try {
            if ((0, helpers_1.isNotEmptyArray)(testCases)) {
                await this.apiClient.upsertTestTestCases(zbrRunId, zbrTestId, { items: testCases });
            }
        }
        catch (error) {
            console.log('Error during saveZbrTestCases:', error);
        }
    }
    async addTestLabels(zbrRunId, zbrTestId, labels) {
        try {
            await this.apiClient.attachTestLabels(zbrRunId, zbrTestId, { items: labels });
        }
        catch (error) {
            console.log('Error during addTestTags:', error);
        }
    }
    async addTestScreenshots(zbrRunId, zbrTestId, screenshotsArray) {
        try {
            if (screenshotsArray.length === 0)
                return;
            const screenshotsPromises = screenshotsArray.map((screenshot) => {
                const file = fs.readFileSync(screenshot.path);
                return this.apiClient.uploadTestScreenshot(zbrRunId, zbrTestId, Buffer.from(file));
            });
            await Promise.all(screenshotsPromises);
        }
        catch (error) {
            console.log('Error during addTestScreenshots:', error);
        }
    }
    async addTestFiles(zbrRunId, zbrTestId, artifactsAttachments) {
        if (artifactsAttachments.length === 0) {
            return;
        }
        try {
            const artifactsPromises = artifactsAttachments.map((file) => {
                const formData = new form_data_1.default();
                formData.append('file', fs.createReadStream(file.path));
                return this.apiClient.uploadTestArtifact(zbrRunId, zbrTestId, formData.getHeaders()['content-type'], formData);
            });
            await Promise.all(artifactsPromises);
        }
        catch (error) {
            console.log('Error during addTestFiles:', error);
        }
    }
    async addSessionVideos(zbrRunId, zbrSessionId, videoPathsArray) {
        try {
            if (videoPathsArray.length === 0) {
                return;
            }
            const videoPromises = videoPathsArray.map((video) => {
                const formData = new form_data_1.default();
                formData.append('video', fs.createReadStream(video.path));
                return this.apiClient.uploadSessionArtifact(zbrRunId, zbrSessionId, formData.getHeaders()['content-type'], (0, helpers_1.getFileSizeInBytes)(video.path), formData);
            });
            await Promise.all(videoPromises);
        }
        catch (error) {
            console.log('Error during addSessionVideos:', error);
        }
    }
    async finishTestSession(zbrRunId, zbrTestSessionId, testEndedAt) {
        try {
            await this.apiClient.finishTestSession(zbrRunId, zbrTestSessionId, { endedAt: testEndedAt });
        }
        catch (error) {
            console.log('Error during finishTestSession:', error);
        }
    }
    async finishTest(zbrRunId, zbrTestId, pwTestResult, maintainer) {
        try {
            const startedAt = new Date(pwTestResult.startTime);
            let endedAt = new Date(startedAt.getTime() + pwTestResult.duration);
            if (startedAt.getTime() === endedAt.getTime()) {
                endedAt = new Date(endedAt.getTime() + 1);
            }
            await this.apiClient.finishTest(zbrRunId, zbrTestId, {
                result: (0, helpers_1.determineStatus)(pwTestResult.status),
                reason: `${(0, helpers_1.cleanseReason)(pwTestResult.error?.message)} \n ${(0, helpers_1.cleanseReason)(pwTestResult.error?.stack)}`,
                endedAt,
            });
        }
        catch (error) {
            console.log('Error during finishTest:', error);
        }
    }
    async sendTestLogs(zbrRunId, zbrLogEntries) {
        try {
            await this.apiClient.sendLogs(zbrRunId, zbrLogEntries);
        }
        catch (error) {
            console.log('Error during sendTestLogs:', error);
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
    async attachRunLabels(zbrRunId, labels) {
        try {
            await this.apiClient.attachTestRunLabels(zbrRunId, { items: labels });
        }
        catch (error) {
            console.log('Error during attachRunLabels:', error);
        }
    }
    async attachRunArtifactReferences(zbrRunId, artifactReferences) {
        try {
            await this.apiClient.attachTestRunArtifactReferences(zbrRunId, { items: artifactReferences });
        }
        catch (error) {
            console.log('Error during attachRunArtifactReferences:', error);
        }
    }
    async addTestArtifactReferences(zbrRunId, zbrTestId, artifactReferences) {
        try {
            await this.apiClient.attachTestArtifactReferences(zbrRunId, zbrTestId, { items: artifactReferences });
        }
        catch (error) {
            console.log('Error during attachTestArtifactReferences:', error);
        }
    }
    async revertTestRegistration(zbrRunId, zbrTestId) {
        try {
            await this.apiClient.revertTestRegistration(zbrRunId, zbrTestId);
        }
        catch (error) {
            console.log('Error during revertTestRegistration:', error);
        }
    }
}
exports.default = ZebrunnerReporter;
//# sourceMappingURL=ZebrunnerReporter.js.map