"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZebrunnerApiClient = void 0;
const axios_1 = __importDefault(require("axios"));
const loglevel_1 = __importDefault(require("loglevel"));
const paths_1 = require("./paths");
const ExchangedRunContext_1 = require("./types/ExchangedRunContext");
const RefreshTokenRequest_1 = require("./types/RefreshTokenRequest");
class ZebrunnerApiClient {
    logger = loglevel_1.default.getLogger('zebrunner.api-client');
    accessToken;
    axiosInstance;
    constructor(reportingConfig) {
        this.accessToken = reportingConfig.server.accessToken;
        this.axiosInstance = axios_1.default.create({
            baseURL: reportingConfig.server.hostname,
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
        });
        this.axiosInstance.interceptors.request.use((config) => {
            // don't log the logs sending because it can produce infinite stream of logs
            if (config.url.indexOf('logs') === -1) {
                let message = `Sending Request\n${config.method.toUpperCase()} ${config.baseURL}${config.url}\n\n`;
                if (!Buffer.isBuffer(config.data)) {
                    message += `Body\n${JSON.stringify(config.data)}`;
                }
                this.logger.debug(message);
            }
            return config;
        }, (error) => error);
        this.axiosInstance.interceptors.response.use((response) => response, (error) => {
            const { request, response } = error;
            let errorMessage = '';
            if (request) {
                errorMessage += `Could not sent request ${request.method} ${request.protocol}//${request.host}${request.path}\n\n`;
            }
            if (response) {
                errorMessage += `Raw response\n${JSON.stringify(response?.data)}\n\n`;
            }
            errorMessage += error.stack;
            this.logger.warn(errorMessage);
            throw error;
        });
    }
    async authenticateIfRequired() {
        if (!this.axiosInstance.defaults.headers.common.Authorization) {
            const request = new RefreshTokenRequest_1.RefreshTokenRequest(this.accessToken);
            const response = await this.axiosInstance.post(paths_1.ZEBRUNNER_PATHS.REFRESH_TOKEN(), request);
            this.axiosInstance.defaults.headers.common.Authorization = `${response.data.authTokenType} ${response.data.authToken}`;
        }
    }
    async startTestRun(projectKey, request) {
        await this.authenticateIfRequired();
        const response = await this.axiosInstance.post(paths_1.ZEBRUNNER_PATHS.START_TEST_RUN(), request, {
            params: { projectKey },
        });
        return response.data.id;
    }
    async startTest(testRunId, request) {
        await this.authenticateIfRequired();
        const response = await this.axiosInstance.post(paths_1.ZEBRUNNER_PATHS.START_TEST(testRunId), request);
        return response.data.id;
    }
    async restartTest(testRunId, testId, request) {
        await this.authenticateIfRequired();
        const response = await this.axiosInstance.post(paths_1.ZEBRUNNER_PATHS.RESTART_TEST(testRunId, testId), request);
        return response.data.id;
    }
    async updateTest(testRunId, testId, request) {
        await this.authenticateIfRequired();
        const response = await this.axiosInstance.patch(paths_1.ZEBRUNNER_PATHS.UPDATE_TEST(testRunId, testId), request);
        return response.data.id;
    }
    async startTestSession(testRunId, request) {
        await this.authenticateIfRequired();
        const response = await this.axiosInstance.post(paths_1.ZEBRUNNER_PATHS.START_TEST_SESSION(testRunId), request);
        return response.data.id;
    }
    async uploadSessionArtifact(testRunId, testSessionId, contentTypeHeader, fileSize, file) {
        const config = {
            headers: {
                'Content-Type': contentTypeHeader,
                Accept: '*/*',
                'x-zbr-video-content-length': fileSize,
            },
        };
        return this.axiosInstance.post(paths_1.ZEBRUNNER_PATHS.UPLOAD_TEST_SESSION_ARTIFACT(testRunId, testSessionId), file, config);
    }
    async finishTestSession(testRunId, testSessionId, request) {
        return this.axiosInstance.put(paths_1.ZEBRUNNER_PATHS.FINISH_TEST_SESSION(testRunId, testSessionId), request);
    }
    async finishTest(testRunId, testId, request) {
        return this.axiosInstance.put(paths_1.ZEBRUNNER_PATHS.FINISH_TEST(testRunId, testId), request);
    }
    async attachTestLabels(testRunId, testId, request) {
        if (request?.items?.length) {
            return this.axiosInstance.put(paths_1.ZEBRUNNER_PATHS.ATTACH_TEST_LABELS(testRunId, testId), request);
        }
    }
    async uploadTestScreenshot(testRunId, testId, screenshot, contentType) {
        const config = {
            headers: {
                'Content-Type': contentType,
                'x-zbr-screenshot-captured-at': new Date().getTime(),
            },
        };
        return this.axiosInstance.post(paths_1.ZEBRUNNER_PATHS.UPLOAD_SCREENSHOT(testRunId, testId), screenshot, config);
    }
    async uploadTestArtifact(testRunId, testId, contentTypeHeader, file) {
        const config = {
            headers: {
                'Content-Type': contentTypeHeader,
                Accept: '*/*',
            },
        };
        return this.axiosInstance.post(paths_1.ZEBRUNNER_PATHS.UPLOAD_TEST_ARTIFACT(testRunId, testId), file, config);
    }
    async uploadTestRunArtifact(testRunId, contentTypeHeader, file) {
        const config = {
            headers: {
                'Content-Type': contentTypeHeader,
                Accept: '*/*',
            },
        };
        return this.axiosInstance.post(paths_1.ZEBRUNNER_PATHS.UPLOAD_TEST_RUN_ARTIFACT(testRunId), file, config);
    }
    async sendLogs(testRunId, logs) {
        if (logs?.length) {
            return this.axiosInstance.post(paths_1.ZEBRUNNER_PATHS.SEND_LOGS(testRunId), logs);
        }
    }
    async finishTestRun(id, request) {
        return this.axiosInstance.put(paths_1.ZEBRUNNER_PATHS.FINISH_TEST_RUN(id), request);
    }
    async exchangeRunContext(runContext) {
        await this.authenticateIfRequired();
        const response = await this.axiosInstance.post(paths_1.ZEBRUNNER_PATHS.EXCHANGE_RUN_CONTEXT(), runContext);
        return new ExchangedRunContext_1.ExchangedRunContext(response.data);
    }
    async updateTcmConfigs(testRunId, request) {
        return this.axiosInstance.patch(paths_1.ZEBRUNNER_PATHS.UPDATE_TCM_CONFIGS(testRunId), request);
    }
    async upsertTestTestCases(testRunId, testId, request) {
        return this.axiosInstance.post(paths_1.ZEBRUNNER_PATHS.UPSERT_TEST_TEST_CASES(testRunId, testId), request);
    }
    async attachTestRunLabels(testRunId, request) {
        if (request?.items?.length) {
            return this.axiosInstance.put(paths_1.ZEBRUNNER_PATHS.ATTACH_TEST_RUN_LABELS(testRunId), request);
        }
    }
    async attachTestRunArtifactReferences(testRunId, request) {
        if (request?.items?.length) {
            return this.axiosInstance.put(paths_1.ZEBRUNNER_PATHS.ATTACH_TEST_RUN_ARTIFACT_REFERENCES(testRunId), request);
        }
    }
    async attachTestArtifactReferences(testRunId, testId, request) {
        if (request?.items?.length) {
            return this.axiosInstance.put(paths_1.ZEBRUNNER_PATHS.ATTACH_TEST_ARTIFACT_REFERENCES(testRunId, testId), request);
        }
    }
    async revertTestRegistration(testRunId, testId) {
        return this.axiosInstance.delete(paths_1.ZEBRUNNER_PATHS.REVERT_TEST_REGISTRATION(testRunId, testId));
    }
}
exports.ZebrunnerApiClient = ZebrunnerApiClient;
//# sourceMappingURL=ZebrunnerApiClient.js.map