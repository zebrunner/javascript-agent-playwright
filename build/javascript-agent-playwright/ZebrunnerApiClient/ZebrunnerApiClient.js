"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZebrunnerApiClient = void 0;
const axios_1 = __importDefault(require("axios"));
const loglevel_1 = __importDefault(require("loglevel"));
const paths_1 = require("./paths");
const types_1 = require("./types");
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
        try {
            if (!this.axiosInstance.defaults.headers.common.Authorization) {
                const request = new types_1.RefreshTokenRequest(this.accessToken);
                const response = await this.axiosInstance.post(paths_1.ZEBRUNNER_PATHS.REFRESH_TOKEN(), request);
                this.axiosInstance.defaults.headers.common.Authorization = `${response.data.authTokenType} ${response.data.authToken}`;
            }
        }
        catch (error) {
            console.log('Zebrunner authentication failed. Please, recheck credentials (hostname and token).');
            process.exit();
        }
    }
    async startLaunch(projectKey, request) {
        await this.authenticateIfRequired();
        try {
            const response = await this.axiosInstance.post(paths_1.ZEBRUNNER_PATHS.START_LAUNCH(), request, {
                params: { projectKey },
            });
            return response.data.id;
        }
        catch (error) {
            console.log(error?.response?.data?.message || 'Unknown error during launch registration in Zebrunner');
            process.exit();
        }
    }
    async startTest(launchId, request) {
        await this.authenticateIfRequired();
        const response = await this.axiosInstance.post(paths_1.ZEBRUNNER_PATHS.START_TEST(launchId), request);
        return response.data.id;
    }
    async restartTest(launchId, testId, request) {
        await this.authenticateIfRequired();
        const response = await this.axiosInstance.post(paths_1.ZEBRUNNER_PATHS.RESTART_TEST(launchId, testId), request);
        return response.data.id;
    }
    async updateTest(launchId, testId, request) {
        await this.authenticateIfRequired();
        const response = await this.axiosInstance.patch(paths_1.ZEBRUNNER_PATHS.UPDATE_TEST(launchId, testId), request);
        return response.data.id;
    }
    async startTestSession(launchId, request) {
        await this.authenticateIfRequired();
        const response = await this.axiosInstance.post(paths_1.ZEBRUNNER_PATHS.START_TEST_SESSION(launchId), request);
        return response.data.id;
    }
    async uploadSessionArtifact(launchId, testSessionId, contentTypeHeader, fileSize, file) {
        const config = {
            headers: {
                'Content-Type': contentTypeHeader,
                Accept: '*/*',
                'x-zbr-video-content-length': fileSize,
            },
        };
        return this.axiosInstance.post(paths_1.ZEBRUNNER_PATHS.UPLOAD_TEST_SESSION_ARTIFACT(launchId, testSessionId), file, config);
    }
    async finishTestSession(launchId, testSessionId, request) {
        return this.axiosInstance.put(paths_1.ZEBRUNNER_PATHS.FINISH_TEST_SESSION(launchId, testSessionId), request);
    }
    async finishTest(launchId, testId, request) {
        return this.axiosInstance.put(paths_1.ZEBRUNNER_PATHS.FINISH_TEST(launchId, testId), request);
    }
    async attachTestLabels(launchId, testId, request) {
        if (request?.items?.length) {
            return this.axiosInstance.put(paths_1.ZEBRUNNER_PATHS.ATTACH_TEST_LABELS(launchId, testId), request);
        }
    }
    async uploadTestScreenshot(launchId, testId, screenshot, timestamp) {
        const config = {
            headers: { 'x-zbr-screenshot-captured-at': timestamp || new Date().getTime() },
        };
        return this.axiosInstance.post(paths_1.ZEBRUNNER_PATHS.UPLOAD_SCREENSHOT(launchId, testId), screenshot, config);
    }
    async uploadTestArtifact(launchId, testId, contentTypeHeader, file) {
        const config = {
            headers: {
                'Content-Type': contentTypeHeader,
                Accept: '*/*',
            },
        };
        return this.axiosInstance.post(paths_1.ZEBRUNNER_PATHS.UPLOAD_TEST_ARTIFACT(launchId, testId), file, config);
    }
    async uploadLaunchArtifact(launchId, contentTypeHeader, file) {
        const config = {
            headers: {
                'Content-Type': contentTypeHeader,
                Accept: '*/*',
            },
        };
        return this.axiosInstance.post(paths_1.ZEBRUNNER_PATHS.UPLOAD_LAUNCH_ARTIFACT(launchId), file, config);
    }
    async sendLogs(launchId, logs) {
        if (logs?.length) {
            return this.axiosInstance.post(paths_1.ZEBRUNNER_PATHS.SEND_LOGS(launchId), logs);
        }
    }
    async finishLaunch(id, request) {
        return this.axiosInstance.put(paths_1.ZEBRUNNER_PATHS.FINISH_LAUNCH(id), request);
    }
    async exchangeLaunchContext(launchContext) {
        await this.authenticateIfRequired();
        const response = await this.axiosInstance.post(paths_1.ZEBRUNNER_PATHS.EXCHANGE_LAUNCH_CONTEXT(), launchContext);
        return new types_1.ExchangedLaunchContext(response.data);
    }
    async updateTcmConfigs(launchId, request) {
        return this.axiosInstance.patch(paths_1.ZEBRUNNER_PATHS.UPDATE_TCM_CONFIGS(launchId), request);
    }
    async upsertTestTestCases(launchId, testId, request) {
        return this.axiosInstance.post(paths_1.ZEBRUNNER_PATHS.UPSERT_TEST_TEST_CASES(launchId, testId), request);
    }
    async attachLaunchLabels(launchId, request) {
        if (request?.items?.length) {
            return this.axiosInstance.put(paths_1.ZEBRUNNER_PATHS.ATTACH_LAUNCH_LABELS(launchId), request);
        }
    }
    async attachLaunchArtifactReferences(launchId, request) {
        if (request?.items?.length) {
            return this.axiosInstance.put(paths_1.ZEBRUNNER_PATHS.ATTACH_LAUNCH_ARTIFACT_REFERENCES(launchId), request);
        }
    }
    async attachTestArtifactReferences(launchId, testId, request) {
        if (request?.items?.length) {
            return this.axiosInstance.put(paths_1.ZEBRUNNER_PATHS.ATTACH_TEST_ARTIFACT_REFERENCES(launchId, testId), request);
        }
    }
    async revertTestRegistration(launchId, testId) {
        return this.axiosInstance.delete(paths_1.ZEBRUNNER_PATHS.REVERT_TEST_REGISTRATION(launchId, testId));
    }
}
exports.ZebrunnerApiClient = ZebrunnerApiClient;
//# sourceMappingURL=ZebrunnerApiClient.js.map