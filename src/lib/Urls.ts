export default class Urls {
  private _projectKey: string;
  private _baseUrl: string;

  constructor(projectKey: string, baseUrl: string) {
    this._projectKey = projectKey;
    this._baseUrl = baseUrl;
  }

  urlRefresh() {
    return {
      url: `${this._baseUrl}/api/iam/v1/auth/refresh`,
      status: 200,
    };
  }
  urlRegisterRun() {
    return {
      url: `${this._baseUrl}/api/reporting/v1/test-runs?projectKey=${this._projectKey}`,
      status: 200,
    };
  }
  urlFinishRun(testRunId: number) {
    return {
      url: `${this._baseUrl}/api/reporting/v1/test-runs/${testRunId}`,
      status: 200,
    };
  }
  urlStartTest(testRunId: number) {
    return {
      url: `${this._baseUrl}/api/reporting/v1/test-runs/${testRunId}/tests`,
      status: 200,
    };
  }
  urlFinishTest(testRunId: number, testId: number) {
    return {
      url: `${this._baseUrl}/api/reporting/v1/test-runs/${testRunId}/tests/${testId}`,
      status: 200,
    };
  }
  urlStartSession(testRunId: number) {
    return {
      url: `${this._baseUrl}/api/reporting/v1/test-runs/${testRunId}/test-sessions`,
      status: 200,
    };
  }
  urlTestRunLabel(testRunId: number) {
    return {
      url: `${this._baseUrl}/api/reporting/v1/test-runs/${testRunId}/labels`,
      status: 204,
    };
  }
  urlFinishSession(testRunId: number, sessionId: string) {
    return {
      url: `${this._baseUrl}/api/reporting/v1/test-runs/${testRunId}/test-sessions/${sessionId}`,
      status: 200,
    };
  }
  urlScreenshots(testRunId: number, testId: number) {
    return {
      url: `${this._baseUrl}/api/reporting/v1/test-runs/${testRunId}/tests/${testId}/screenshots`,
      status: 201,
    };
  }
  urlTestExecutionLabel(testRunId: number, testId: number) {
    return {
      url: `${this._baseUrl}/api/reporting/v1/test-runs/${testRunId}/tests/${testId}/labels`,
      status: 204,
    };
  }
  urlSendLogs(testRunId: number) {
    return {
      url: `${this._baseUrl}/api/reporting/v1/test-runs/${testRunId}/logs`,
      status: 202,
    };
  }
  urlTestArtifacts(testRunId: number, testId: number) {
    return {
      url: `${this._baseUrl}/api/reporting/v1/test-runs/${testRunId}/tests/${testId}/artifacts`,
      status: 201,
    };
  }
  urlSessionArtifacts(testRunId: number, testSessionId: number) {
    return {
      url: `${this._baseUrl}/api/reporting/v1/test-runs/${testRunId}/test-sessions/${testSessionId}/artifacts`,
      status: 201,
    };
  }
  urlRerunRequest() {
    return {
      url: `${this._baseUrl}/api/reporting/v1/run-context-exchanges`,
      status: 200,
    };
  }
  urlRerunTestStart(testRunId: number, testId: number) {
    return {
      url: `${this._baseUrl}/api/reporting/v1/test-runs/${testRunId}/tests/${testId}`,
      status: 200,
    };
  }
}
