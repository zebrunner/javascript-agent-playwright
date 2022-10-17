import {AxiosResponse} from 'axios';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import Logger from '../lib/Logger';
import Api from './Api';
import Urls from './Urls';
import {browserCapabilities, testStep} from './ResultsParser';
import {zebrunnerConfig} from './ZebrunnerReporter';
const FormData = require('form-data');

export default class ZebAgent {
  private _refreshToken: string;
  private _header: any;
  private _urls: Urls;
  private _accessToken: string;
  private _projectKey: string;
  private _reportBaseUrl: string;
  private _concurrentTasks: number;
  private _enabled: boolean;
  private _api: Api;
  private readonly _defaultConcurrentTask = 10;
  private readonly _maximumConcurrentTask = 20;

  constructor(config: zebrunnerConfig) {
    this._accessToken = process.env.REPORTING_SERVER_ACCESS_TOKEN;
    this._projectKey = config.reportingProjectKey || 'DEF';
    this._reportBaseUrl = config.reportingServerHostname;

    if (config.enabled) {
      this._enabled = true;
    } else {
      this._enabled = false;
    }

    this._concurrentTasks = config.pwConcurrentTasks || this._defaultConcurrentTask;

    if (this._concurrentTasks > this._maximumConcurrentTask) {
      this._concurrentTasks = this._maximumConcurrentTask;
    }

    this._urls = new Urls(this._projectKey, this._reportBaseUrl);
    this._api = new Api(2, 1000);
  }

  async initialize() {
    try {
      const payload = {
        refreshToken: this._accessToken,
      };

      let endpoint = this._urls.urlRefresh();
      let r = await this._api.post({
        url: endpoint.url,
        payload: payload,
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
      Logger.log(
        `initialize complete: obtained refreshToken ${this._refreshToken.substring(0, 10)}*****}`
      );
      Logger.log(`BASE_URL => ${this._reportBaseUrl}`);
      Logger.log(`ACCESS_TOKEN => ${this._accessToken.substring(0, 4)}*****`);
      Logger.log(`PROJECT_KEY => ${this._projectKey}`);
    } catch (error) {
      console.log(error);
    }
  }

  public get concurrency() {
    return this._concurrentTasks;
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
      let endpoint = this._urls.urlRegisterRun();
      let r = await this._api.post({
        url: endpoint.url,
        payload: payload,
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
    }
  ): Promise<AxiosResponse> {
    try {
      let endpoint = this._urls.urlStartTest(testRunId);
      let r = await this._api.post({
        url: endpoint.url,
        payload: payload,
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
      labels?: {key: string; value: string}[];
      correlationData?: string;
    }
  ) {
    try {
      let endpoint = this._urls.urlRerunTestStart(testRunId, testId);
      let r = await this._api.post({
        url: endpoint.url,
        payload: payload,
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
    }
  ): Promise<AxiosResponse> {
    try {
      let endpoint = this._urls.urlFinishTest(testRunId, testId);
      let r = await this._api.put({
        url: endpoint.url,
        payload: payload,
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
    }
  ): Promise<AxiosResponse> {
    try {
      const endpoint = this._urls.urlFinishRun(testRunId);
      let r = await this._api.put({
        url: endpoint.url,
        payload: payload,
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
    screenshotsArray?: Record<string, number>[]
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
    artifactsAttachments?: Record<string, string>[]
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
    videoPathsArray: Record<string, string>[]
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
    return fileSizeInBytes;
  };

  async addTestLogs(testRunId: number, logs: testStep[]): Promise<AxiosResponse> {
    try {
      if (logs.length <= 0) return;
      const endpoint = this._urls.urlSendLogs(testRunId);
      let r = await this._api.post({
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

      let payload = {
        items,
      };

      const endpoint = this._urls.urlTestExecutionLabel(testRunId, testId);
      let r = await this._api.put({
        url: endpoint.url,
        payload: payload,
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

      let payload = {
        items,
      };

      const endpoint = this._urls.urlTestRunLabel(testRunId);
      let r = await this._api.put(
        {
          url: endpoint.url,
          payload: payload,
          expectedStatusCode: endpoint.status,
          config: this._header,
        },
        0
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
    let payload = {
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
      let r = await this._api.post({
        url: endpoint.url,
        payload: payload,
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
    testIds: number[] | number
  ): Promise<AxiosResponse> {
    try {
      let payload = {
        endedAt: endedAt,
        testIds: [],
      };
      payload.testIds.push(testIds);
      const endpoint = this._urls.urlFinishSession(testRunId, sessionId);
      
      let r = await this._api.put({
        url: endpoint.url,
        payload: payload,
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
      let r = await this._api.post({
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
