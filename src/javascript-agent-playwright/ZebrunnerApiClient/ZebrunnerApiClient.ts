import axios, { AxiosInstance, AxiosResponse, AxiosRequestConfig } from 'axios';
import log from 'loglevel';
import { ZEBRUNNER_PATHS } from './paths';
import { ReportingConfig } from '../ReportingConfig';
import {
  AttachArtifactReferencesRequest,
  AttachLabelsRequest,
  ExchangedLaunchContext,
  FinishTestRequest,
  FinishLaunchRequest,
  FinishTestSessionRequest,
  RefreshTokenRequest,
  StartOrUpdateTestRequest,
  StartLaunchRequest,
  StartTestSessionRequest,
  UpdateTcmConfigsRequest,
} from './types';
import { TestLog, ZbrTestCase } from '../types';

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

  async startLaunch(projectKey: string, request: StartLaunchRequest): Promise<number> {
    await this.authenticateIfRequired();
    try {
      const response = await this.axiosInstance.post(ZEBRUNNER_PATHS.START_LAUNCH(), request, {
        params: { projectKey },
      });

      return response.data.id as number;
    } catch (error) {
      console.log(error?.response?.data?.message || 'Unknown error during launch registration in Zebrunner');
      process.exit();
    }
  }

  async startTest(launchId: number, request: StartOrUpdateTestRequest): Promise<number> {
    await this.authenticateIfRequired();
    const response = await this.axiosInstance.post(ZEBRUNNER_PATHS.START_TEST(launchId), request);

    return response.data.id as number;
  }

  async restartTest(launchId: number, testId: number, request: StartOrUpdateTestRequest): Promise<number> {
    await this.authenticateIfRequired();
    const response = await this.axiosInstance.post(ZEBRUNNER_PATHS.RESTART_TEST(launchId, testId), request);

    return response.data.id as number;
  }

  async updateTest(launchId: number, testId: number, request: StartOrUpdateTestRequest): Promise<number> {
    await this.authenticateIfRequired();
    const response = await this.axiosInstance.patch(ZEBRUNNER_PATHS.UPDATE_TEST(launchId, testId), request);

    return response.data.id as number;
  }

  async startTestSession(launchId: number, request: StartTestSessionRequest): Promise<number> {
    await this.authenticateIfRequired();
    const response = await this.axiosInstance.post(ZEBRUNNER_PATHS.START_TEST_SESSION(launchId), request);

    return response.data.id as number;
  }

  async uploadSessionArtifact(
    launchId: number,
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

    return this.axiosInstance.post(ZEBRUNNER_PATHS.UPLOAD_TEST_SESSION_ARTIFACT(launchId, testSessionId), file, config);
  }

  async finishTestSession(
    launchId: number,
    testSessionId: number,
    request: FinishTestSessionRequest,
  ): Promise<AxiosResponse> {
    return this.axiosInstance.put(ZEBRUNNER_PATHS.FINISH_TEST_SESSION(launchId, testSessionId), request);
  }

  async finishTest(launchId: number, testId: number, request: FinishTestRequest): Promise<AxiosResponse> {
    return this.axiosInstance.put(ZEBRUNNER_PATHS.FINISH_TEST(launchId, testId), request);
  }

  async attachTestLabels(launchId: number, testId: number, request: AttachLabelsRequest): Promise<AxiosResponse> {
    if (request?.items?.length) {
      return this.axiosInstance.put(ZEBRUNNER_PATHS.ATTACH_TEST_LABELS(launchId, testId), request);
    }
  }

  async uploadTestScreenshot(launchId: number, testId: number, screenshot: Buffer, timestamp?: number): Promise<void> {
    const config: AxiosRequestConfig = {
      headers: { 'x-zbr-screenshot-captured-at': timestamp || new Date().getTime() },
    };

    return this.axiosInstance.post(ZEBRUNNER_PATHS.UPLOAD_SCREENSHOT(launchId, testId), screenshot, config);
  }

  async uploadTestArtifact(
    launchId: number,
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

    return this.axiosInstance.post(ZEBRUNNER_PATHS.UPLOAD_TEST_ARTIFACT(launchId, testId), file, config);
  }

  async uploadLaunchArtifact(
    launchId: number,
    contentTypeHeader: string,
    file: import('form-data') | Buffer,
  ): Promise<void> {
    const config: AxiosRequestConfig = {
      headers: {
        'Content-Type': contentTypeHeader,
        Accept: '*/*',
      },
    };

    return this.axiosInstance.post(ZEBRUNNER_PATHS.UPLOAD_LAUNCH_ARTIFACT(launchId), file, config);
  }

  async sendLogs(launchId: number, logs: TestLog[]): Promise<AxiosResponse> {
    if (logs?.length) {
      return this.axiosInstance.post(ZEBRUNNER_PATHS.SEND_LOGS(launchId), logs);
    }
  }

  async finishLaunch(id: number, request: FinishLaunchRequest): Promise<AxiosResponse> {
    return this.axiosInstance.put(ZEBRUNNER_PATHS.FINISH_LAUNCH(id), request);
  }

  async exchangeLaunchContext(launchContext: string): Promise<ExchangedLaunchContext> {
    await this.authenticateIfRequired();
    const response = await this.axiosInstance.post(ZEBRUNNER_PATHS.EXCHANGE_LAUNCH_CONTEXT(), launchContext);

    return new ExchangedLaunchContext(response.data);
  }

  async updateTcmConfigs(launchId: number, request: UpdateTcmConfigsRequest): Promise<AxiosResponse> {
    return this.axiosInstance.patch(ZEBRUNNER_PATHS.UPDATE_TCM_CONFIGS(launchId), request);
  }

  async upsertTestTestCases(
    launchId: number,
    testId: number,
    request: { items: ZbrTestCase[] },
  ): Promise<AxiosResponse> {
    return this.axiosInstance.post(ZEBRUNNER_PATHS.UPSERT_TEST_TEST_CASES(launchId, testId), request);
  }

  async attachLaunchLabels(launchId: number, request: AttachLabelsRequest): Promise<AxiosResponse> {
    if (request?.items?.length) {
      return this.axiosInstance.put(ZEBRUNNER_PATHS.ATTACH_LAUNCH_LABELS(launchId), request);
    }
  }

  async attachLaunchArtifactReferences(
    launchId: number,
    request: AttachArtifactReferencesRequest,
  ): Promise<AxiosResponse> {
    if (request?.items?.length) {
      return this.axiosInstance.put(ZEBRUNNER_PATHS.ATTACH_LAUNCH_ARTIFACT_REFERENCES(launchId), request);
    }
  }

  async attachTestArtifactReferences(
    launchId: number,
    testId: number,
    request: AttachArtifactReferencesRequest,
  ): Promise<AxiosResponse> {
    if (request?.items?.length) {
      return this.axiosInstance.put(ZEBRUNNER_PATHS.ATTACH_TEST_ARTIFACT_REFERENCES(launchId, testId), request);
    }
  }

  async revertTestRegistration(launchId: number, testId: number): Promise<AxiosResponse> {
    return this.axiosInstance.delete(ZEBRUNNER_PATHS.REVERT_TEST_REGISTRATION(launchId, testId));
  }
}
