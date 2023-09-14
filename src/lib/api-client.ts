import axios, { AxiosInstance, AxiosResponse } from 'axios';
import log from 'loglevel';
import { ZebrunnerPaths } from './constant/zebrunner-paths';
import { ReportingConfig } from './reporting-config';
import { ExchangedRunContext } from './types/exchanged-run-context';
import { FinishTestRunRequest } from './types/finish-test-run';
import { RefreshTokenRequest } from './types/refresh-token';
import { StartTestRunRequest } from './types/start-test-run';
import { UpdateTcmConfigsRequest } from './types/update-tcm-configs';
import { UpsertTestTestCases } from './types/upsert-test-test-cases';

export default class ApiClient {

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
      const {
        request,
        response
      } = error;

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

  private async authenticateIfRequired() {
    if (!this.axiosInstance.defaults.headers.common.Authorization) {
      const request = new RefreshTokenRequest(this.accessToken);
      const response = await this.axiosInstance.post(ZebrunnerPaths.REFRESH_TOKEN(), request);

      this.axiosInstance.defaults.headers.common.Authorization = `${response.data.authTokenType} ${response.data.authToken}`;
    }
  }

  async startTestRun(projectKey: string, request: StartTestRunRequest): Promise<number> {
    await this.authenticateIfRequired();

    const response = await this.axiosInstance.post(ZebrunnerPaths.START_TEST_RUN(), request, { params: { projectKey } });
    return response.data.id as number;
  }

  async finishTestRun(id: number, request: FinishTestRunRequest): Promise<AxiosResponse> {
    return this.axiosInstance.put(ZebrunnerPaths.FINISH_TEST_RUN(id), request);
  }

  async exchangeRunContext(runContext: string): Promise<ExchangedRunContext> {
    await this.authenticateIfRequired();

    const response = await this.axiosInstance.post(ZebrunnerPaths.EXCHANGE_RUN_CONTEXT(), runContext);
    return new ExchangedRunContext(response.data);
  }

  async updateTcmConfigs(testRunId: number, request: UpdateTcmConfigsRequest): Promise<void> {
    return this.axiosInstance.patch(ZebrunnerPaths.UPDATE_TCM_CONFIGS(testRunId), request);
  }

  async upsertTestTestCases(testRunId: number, testId: number, request: UpsertTestTestCases): Promise<void> {
    return this.axiosInstance.post(ZebrunnerPaths.UPSERT_TEST_TEST_CASES(testRunId, testId), request);
  }

}
