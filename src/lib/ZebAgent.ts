import { AxiosResponse } from 'axios';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import FormData from 'form-data';
import Api from './Api';
import { browserCapabilities, testStep } from './ResultsParser';
import Urls from './Urls';
import ApiClient from './api-client';
import { ReportingConfig } from './reporting-config';

/**
 * @deprecated Use {@link ApiClient} instead
 */
export default class ZebAgent {
  private _refreshToken: string;

  private _header: any;

  private _urls: Urls;

  private _accessToken: string;

  private _projectKey: string;

  private _reportBaseUrl: string;

  private _enabled: boolean;

  private _api: Api;

  constructor(config: ReportingConfig) {
    this._accessToken = config.server.accessToken;
    this._projectKey = config.projectKey;
    this._reportBaseUrl = config.server.hostname;

    if (config.enabled) {
      this._enabled = true;
    } else {
      this._enabled = false;
    }

    this._urls = new Urls(this._projectKey, this._reportBaseUrl);
    this._api = new Api(2, 1000);
  }

  async initialize() {
    try {
      const payload = {
        refreshToken: this._accessToken,
      };

      const endpoint = this._urls.urlRefresh();
      const r = await this._api.post({
        url: endpoint.url,
        payload,
        expectedStatusCode: endpoint.status,
      });

      if (!r) {
        throw new Error('Failed to obtain refresh token');
      }

      this._refreshToken = `Bearer ${r.data.authToken}`;
      this._header = {
        headers: {
          Authorization: this._refreshToken,
        },
      };
    } catch (error) {
      console.log(error);
    }
  }

  public get isEnabled() {
    return this._enabled;
  }

  public get projectKey() {
    return this._projectKey;
  }

  public get baseUrl() {
    return this._reportBaseUrl;
  }

  async startTestRun(payload: {
    uuid?: string;
    name: string;
    startedAt: string;
    status?: 'IN_PROGRESS' | 'QUEUED';
    framework: string;
    config?: any;
    milestone?: any;
    notifications: {
      notifyOnEachFailure: boolean;
      targets: {
        type: string;
        value: string;
      }[];
    };
  }): Promise<AxiosResponse> {
    try {
      const endpoint = this._urls.urlRegisterRun();
      const r = await this._api.post({
        url: endpoint.url,
        payload,
        expectedStatusCode: endpoint.status,
        config: this._header,
      });
      return r;
    } catch (error) {
      console.log(error);
    }
  }

  async startTestExecution(
    testRunId: number,
    payload: {
      name: string;
      className: string;
      methodName: string;
      startedAt: Date;
      maintainer?: string;
      testCase?: string;
      labels?: {
        key: string;
        value: string;
      }[];
      correlationData?: string;
    },
  ): Promise<AxiosResponse> {
    try {
      const endpoint = this._urls.urlStartTest(testRunId);
      const r = await this._api.post({
        url: endpoint.url,
        payload,
        expectedStatusCode: endpoint.status,
        config: this._header,
      });
      return r;
    } catch (error) {
      console.log(error);
    }
  }

  async startRerunTestExecution(
    testRunId: number,
    testId: number,
    payload: {
      name: string;
      className: string;
      methodName: string;
      startedAt: Date;
      maintainer?: string;
      testCase?: string;
      labels?: { key: string; value: string }[];
      correlationData?: string;
    },
  ) {
    try {
      const endpoint = this._urls.urlRerunTestStart(testRunId, testId);
      const r = await this._api.post({
        url: endpoint.url,
        payload,
        expectedStatusCode: endpoint.status,
        config: this._header,
      });
      return r;
    } catch (error) {
      console.log(error);
    }
  }

  async finishTestExecution(
    testRunId: number,
    testId: number,
    payload: {
      result: 'PASSED' | 'FAILED' | 'ABORTED' | 'SKIPPED';
      reason?: string;
      endedAt?: Date;
    },
  ): Promise<AxiosResponse> {
    try {
      const endpoint = this._urls.urlFinishTest(testRunId, testId);
      const r = await this._api.put({
        url: endpoint.url,
        payload,
        expectedStatusCode: endpoint.status,
        config: this._header,
      });
      return r;
    } catch (error) {
      console.log(error);
    }
  }

  async finishTestRun(
    testRunId: number,
    payload: {
      endedAt: string;
    },
  ): Promise<AxiosResponse> {
    try {
      const endpoint = this._urls.urlFinishRun(testRunId);
      const r = await this._api.put({
        url: endpoint.url,
        payload,
        expectedStatusCode: endpoint.status,
        config: this._header,
      });
      return r;
    } catch (error) {
      console.log(error);
    }
  }

  async attachScreenshot(
    testRunId?: number,
    testId?: number,
    screenshotsArray?: Record<string, number>[],
  ): Promise<AxiosResponse> {
    try {
      if (screenshotsArray.length === 0) return;

      const screenshotsPromises = screenshotsArray.map((screenshot) => {
        const file = fs.readFileSync(screenshot.path);
        const endpoint = this._urls.urlScreenshots(testRunId, testId);
        return this._api.post({
          url: endpoint.url,
          payload: Buffer.from(file),
          expectedStatusCode: endpoint.status,
          config: {
            headers: {
              Authorization: this._refreshToken,
              'Content-Type': 'image/png',
              'x-zbr-screenshot-captured-at': screenshot.timestamp,
            },
          },
        });
      });

      const response = await Promise.all(screenshotsPromises);

      return response[0];
    } catch (error) {
      console.log(error);
    }
  }

  async attachTestArtifacts(
    testRunId?: number,
    testId?: number,
    artifactsAttachments?: Record<string, string>[],
  ): Promise<AxiosResponse> {
    if (artifactsAttachments.length === 0) {
      return;
    }
    try {
      const artifactsPromises = artifactsAttachments.map((file) => {
        const formData = new FormData();
        formData.append('file', fs.createReadStream(file.path));
        const endpoint = this._urls.urlTestArtifacts(testRunId, testId);
        const contentTypeHeader = formData.getHeaders()['content-type'];
        return this._api.post({
          url: endpoint.url,
          payload: formData,
          expectedStatusCode: endpoint.status,
          config: {
            headers: {
              Authorization: this._refreshToken,
              'Content-Type': contentTypeHeader,
              Accept: '*/*',
            },
          },
        });
      });
      const response = await Promise.all(artifactsPromises);
      return response[0];
    } catch (e) {
      console.log(e);
    }
  }

  async sendVideoArtifacts(
    testRunId: number,
    testSessionId: number,
    videoPathsArray: Record<string, string>[],
  ) {
    try {
      if (videoPathsArray.length === 0) {
        return;
      }

      const promise = videoPathsArray.map((video) => {
        const formData = new FormData();

        formData.append('video', fs.createReadStream(video.path));
        const endpoint = this._urls.urlSessionArtifacts(testRunId, testSessionId);
        const contentTypeHeader = formData.getHeaders()['content-type'];
        const fileSize = this._getFileSizeInBytes(video.path);
        return this._api.post({
          url: endpoint.url,
          payload: formData,
          expectedStatusCode: endpoint.status,
          config: {
            headers: {
              Authorization: this._refreshToken,
              'Content-Type': contentTypeHeader,
              Accept: '*/*',
              'x-zbr-video-content-length': fileSize,
            },
          },
        });
      });

      const response = await Promise.all(promise);
      return response[0];
    } catch (error) {
      console.log(error);
    }
  }

  _getFileSizeInBytes = (filename) => {
    const stats = fs.statSync(filename);
    const fileSizeInBytes = stats.size;
    console.log('size', fileSizeInBytes);
    return fileSizeInBytes;
  };

  async addTestLogs(testRunId: number, logs: testStep[]): Promise<AxiosResponse> {
    try {
      if (logs.length <= 0) return;
      const endpoint = this._urls.urlSendLogs(testRunId);
      const r = await this._api.post({
        url: endpoint.url,
        payload: logs,
        expectedStatusCode: endpoint.status,
        config: this._header,
      });
      return r;
    } catch (error) {
      console.log(error);
    }
  }

  async addTestTags(testRunId: number, testId: number, items: any[]): Promise<AxiosResponse> {
    try {
      if (!items) return;

      const payload = {
        items,
      };

      const endpoint = this._urls.urlTestExecutionLabel(testRunId, testId);
      const r = await this._api.put({
        url: endpoint.url,
        payload,
        expectedStatusCode: endpoint.status,
        config: this._header,
      });
      return r;
    } catch (error) {
      console.log(error);
    }
  }

  async addTestRunTags(testRunId: number, items: any[]): Promise<AxiosResponse> {
    try {
      if (items.length === 0) return;

      const payload = {
        items,
      };

      const endpoint = this._urls.urlTestRunLabel(testRunId);
      const r = await this._api.put(
        {
          url: endpoint.url,
          payload,
          expectedStatusCode: endpoint.status,
          config: this._header,
        },
        0,
      );
      return r;
    } catch (error) {
      console.log(error);
    }
  }

  async startTestSession(options: {
    browserCapabilities: browserCapabilities;
    startedAt: Date;
    testRunId: number;
    testIds: number[] | number;
  }): Promise<AxiosResponse> {
    const payload = {
      sessionId: uuidv4(),
      initiatedAt: options.startedAt,
      startedAt: options.startedAt,
      desiredCapabilities: {
        browserName: options.browserCapabilities.browser.name || 'n/a',
        browserVersion: options.browserCapabilities.browser.version || 'n/a',
        platformName: options.browserCapabilities.os.name || 'n/a',
      },
      capabilities: {
        browserName: options.browserCapabilities.browser.name || 'n/a',
        browserVersion: options.browserCapabilities.browser.version || 'n/a',
        platformName: options.browserCapabilities.os.name || 'n/a',
      },
      testIds: [],
    };
    payload.testIds.push(options.testIds);

    try {
      const endpoint = this._urls.urlStartSession(options.testRunId);
      const r = await this._api.post({
        url: endpoint.url,
        payload,
        expectedStatusCode: endpoint.status,
        config: this._header,
      });
      return r;
    } catch (error) {
      console.log(error);
    }
  }

  async finishTestSession(
    sessionId: number,
    testRunId: number,
    endedAt: Date,
    testIds: number[] | number,
  ): Promise<AxiosResponse> {
    try {
      const payload = {
        endedAt,
        testIds: [],
      };
      payload.testIds.push(testIds);
      const endpoint = this._urls.urlFinishSession(testRunId, sessionId);

      const r = await this._api.put({
        url: endpoint.url,
        payload,
        expectedStatusCode: endpoint.status,
        config: this._header,
      });
      return r;
    } catch (error) {
      console.log(error);
    }
  }

  async rerunRequest(payload) {
    try {
      const endpoint = this._urls.urlRerunRequest();
      const r = await this._api.post({
        url: endpoint.url,
        payload,
        expectedStatusCode: endpoint.status,
        config: this._header,
      });
      return r;
    } catch (error) {
      console.log('err', error);
    }
  }
}
