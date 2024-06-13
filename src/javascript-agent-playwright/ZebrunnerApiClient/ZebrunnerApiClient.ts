import axios, { AxiosInstance, AxiosResponse, AxiosRequestConfig } from 'axios';
import log from 'loglevel';
import { ZEBRUNNER_PATHS } from './paths';
import { ReportingConfig } from '../ReportingConfig';
import { ExchangedRunContext } from './types/ExchangedRunContext';
import { FinishTestRunRequest } from './types/FinishTestRunRequest';
import { RefreshTokenRequest } from './types/RefreshTokenRequest';
import { StartTestRunRequest } from './types/StartTestRunRequest';
import { UpdateTcmConfigsRequest } from './types/UpdateTcmConfigsRequest';
import { TestStep, ZbrTestCase } from '../types';
import { AttachLabelsRequest } from './types/AttachLabelsRequest';
import { AttachArtifactReferencesRequest } from './types/AttachArtifactReferencesRequest';
import { StartOrUpdateTestRequest } from './types/StartOrUpdateTestRequest';
import { StartTestSessionRequest } from './types/StartTestSessionRequest';
import { FinishTestSessionRequest } from './types/FinishTestSessionRequest';
import { FinishTestRequest } from './types/FinishTestRequest';

export class ZebrunnerApiClient {
  private readonly logger = log.getLogger('zebrunner.api-client');
  private readonly accessToken: string;
  private readonly axiosInstance: AxiosInstance;

  constructor(reportingConfig: ReportingConfig) {
    this.accessToken = reportingConfig.server.accessToken;
    this.axiosInstance = axios.create({
      baseURL: reportingConfig.server.hostname,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    });

    this.axiosInstance.interceptors.request.use(
      (config) => {
        // don't log the logs sending because it can produce infinite stream of logs
        if (config.url.indexOf('logs') === -1) {
          let message = `Sending Request\n${config.method.toUpperCase()} ${config.baseURL}${config.url}\n\n`;
          if (!Buffer.isBuffer(config.data)) {
            message += `Body\n${JSON.stringify(config.data)}`;
          }

          this.logger.debug(message);
        }
        return config;
      },
      (error) => error,
    );
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      (error) => {
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
      },
    );
  }

  private async authenticateIfRequired() {
    try {
      if (!this.axiosInstance.defaults.headers.common.Authorization) {
        const request = new RefreshTokenRequest(this.accessToken);
        const response = await this.axiosInstance.post(ZEBRUNNER_PATHS.REFRESH_TOKEN(), request);

        this.axiosInstance.defaults.headers.common.Authorization = `${response.data.authTokenType} ${response.data.authToken}`;
      }
    } catch (error) {
      console.log('Zebrunner authentication failed. Please, recheck credentials (hostname and token).');
      process.exit();
    }
  }

  async startTestRun(projectKey: string, request: StartTestRunRequest): Promise<number> {
    await this.authenticateIfRequired();
    try {
      const response = await this.axiosInstance.post(ZEBRUNNER_PATHS.START_TEST_RUN(), request, {
        params: { projectKey },
      });

      return response.data.id as number;
    } catch (error) {
      console.log(error?.response?.data?.message || 'Unknown error during launch registration in Zebrunner');
      process.exit();
    }
  }

  async startTest(testRunId: number, request: StartOrUpdateTestRequest): Promise<number> {
    await this.authenticateIfRequired();
    const response = await this.axiosInstance.post(ZEBRUNNER_PATHS.START_TEST(testRunId), request);

    return response.data.id as number;
  }

  async restartTest(testRunId: number, testId: number, request: StartOrUpdateTestRequest): Promise<number> {
    await this.authenticateIfRequired();
    const response = await this.axiosInstance.post(ZEBRUNNER_PATHS.RESTART_TEST(testRunId, testId), request);

    return response.data.id as number;
  }

  async updateTest(testRunId: number, testId: number, request: StartOrUpdateTestRequest): Promise<number> {
    await this.authenticateIfRequired();
    const response = await this.axiosInstance.patch(ZEBRUNNER_PATHS.UPDATE_TEST(testRunId, testId), request);

    return response.data.id as number;
  }

  async startTestSession(testRunId: number, request: StartTestSessionRequest): Promise<number> {
    await this.authenticateIfRequired();
    const response = await this.axiosInstance.post(ZEBRUNNER_PATHS.START_TEST_SESSION(testRunId), request);

    return response.data.id as number;
  }

  async uploadSessionArtifact(
    testRunId: number,
    testSessionId: number,
    contentTypeHeader: string,
    fileSize: number,
    file: import('form-data'),
  ): Promise<void> {
    const config: AxiosRequestConfig = {
      headers: {
        'Content-Type': contentTypeHeader,
        Accept: '*/*',
        'x-zbr-video-content-length': fileSize,
      },
    };

    return this.axiosInstance.post(
      ZEBRUNNER_PATHS.UPLOAD_TEST_SESSION_ARTIFACT(testRunId, testSessionId),
      file,
      config,
    );
  }

  async finishTestSession(
    testRunId: number,
    testSessionId: number,
    request: FinishTestSessionRequest,
  ): Promise<AxiosResponse> {
    return this.axiosInstance.put(ZEBRUNNER_PATHS.FINISH_TEST_SESSION(testRunId, testSessionId), request);
  }

  async finishTest(testRunId: number, testId: number, request: FinishTestRequest): Promise<AxiosResponse> {
    return this.axiosInstance.put(ZEBRUNNER_PATHS.FINISH_TEST(testRunId, testId), request);
  }

  async attachTestLabels(testRunId: number, testId: number, request: AttachLabelsRequest): Promise<AxiosResponse> {
    if (request?.items?.length) {
      return this.axiosInstance.put(ZEBRUNNER_PATHS.ATTACH_TEST_LABELS(testRunId, testId), request);
    }
  }

  async uploadTestScreenshot(testRunId: number, testId: number, screenshot: Buffer, timestamp?: number): Promise<void> {
    const config: AxiosRequestConfig = {
      headers: { 'x-zbr-screenshot-captured-at': timestamp || new Date().getTime() },
    };

    return this.axiosInstance.post(ZEBRUNNER_PATHS.UPLOAD_SCREENSHOT(testRunId, testId), screenshot, config);
  }

  async uploadTestArtifact(
    testRunId: number,
    testId: number,
    contentTypeHeader: string,
    file: import('form-data'),
  ): Promise<void> {
    const config: AxiosRequestConfig = {
      headers: {
        'Content-Type': contentTypeHeader,
        Accept: '*/*',
      },
    };

    return this.axiosInstance.post(ZEBRUNNER_PATHS.UPLOAD_TEST_ARTIFACT(testRunId, testId), file, config);
  }

  async uploadTestRunArtifact(
    testRunId: number,
    contentTypeHeader: string,
    file: import('form-data') | Buffer,
  ): Promise<void> {
    const config: AxiosRequestConfig = {
      headers: {
        'Content-Type': contentTypeHeader,
        Accept: '*/*',
      },
    };

    return this.axiosInstance.post(ZEBRUNNER_PATHS.UPLOAD_TEST_RUN_ARTIFACT(testRunId), file, config);
  }

  async sendLogs(testRunId: number, logs: TestStep[]): Promise<AxiosResponse> {
    if (logs?.length) {
      return this.axiosInstance.post(ZEBRUNNER_PATHS.SEND_LOGS(testRunId), logs);
    }
  }

  async finishTestRun(id: number, request: FinishTestRunRequest): Promise<AxiosResponse> {
    return this.axiosInstance.put(ZEBRUNNER_PATHS.FINISH_TEST_RUN(id), request);
  }

  async exchangeRunContext(runContext: string): Promise<ExchangedRunContext> {
    await this.authenticateIfRequired();
    const response = await this.axiosInstance.post(ZEBRUNNER_PATHS.EXCHANGE_RUN_CONTEXT(), runContext);

    return new ExchangedRunContext(response.data);
  }

  async updateTcmConfigs(testRunId: number, request: UpdateTcmConfigsRequest): Promise<AxiosResponse> {
    return this.axiosInstance.patch(ZEBRUNNER_PATHS.UPDATE_TCM_CONFIGS(testRunId), request);
  }

  async upsertTestTestCases(
    testRunId: number,
    testId: number,
    request: { items: ZbrTestCase[] },
  ): Promise<AxiosResponse> {
    return this.axiosInstance.post(ZEBRUNNER_PATHS.UPSERT_TEST_TEST_CASES(testRunId, testId), request);
  }

  async attachTestRunLabels(testRunId: number, request: AttachLabelsRequest): Promise<AxiosResponse> {
    if (request?.items?.length) {
      return this.axiosInstance.put(ZEBRUNNER_PATHS.ATTACH_TEST_RUN_LABELS(testRunId), request);
    }
  }

  async attachTestRunArtifactReferences(
    testRunId: number,
    request: AttachArtifactReferencesRequest,
  ): Promise<AxiosResponse> {
    if (request?.items?.length) {
      return this.axiosInstance.put(ZEBRUNNER_PATHS.ATTACH_TEST_RUN_ARTIFACT_REFERENCES(testRunId), request);
    }
  }

  async attachTestArtifactReferences(
    testRunId: number,
    testId: number,
    request: AttachArtifactReferencesRequest,
  ): Promise<AxiosResponse> {
    if (request?.items?.length) {
      return this.axiosInstance.put(ZEBRUNNER_PATHS.ATTACH_TEST_ARTIFACT_REFERENCES(testRunId, testId), request);
    }
  }

  async revertTestRegistration(testRunId: number, testId: number): Promise<AxiosResponse> {
    return this.axiosInstance.delete(ZEBRUNNER_PATHS.REVERT_TEST_REGISTRATION(testRunId, testId));
  }
}
