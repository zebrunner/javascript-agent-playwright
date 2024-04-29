export const ZebrunnerPaths = {
  REFRESH_TOKEN: () => '/api/iam/v1/auth/refresh',
  EXCHANGE_RUN_CONTEXT: () => '/api/reporting/v1/run-context-exchanges',

  START_TEST_RUN: () => '/api/reporting/v1/test-runs',
  FINISH_TEST_RUN: (testRunId) => `/api/reporting/v1/test-runs/${testRunId}`,

  START_TEST: (testRunId) => `/api/reporting/v1/test-runs/${testRunId}/tests`,
  UPDATE_TEST: (testRunId, testId) => `/api/reporting/v1/test-runs/${testRunId}/tests/${testId}`,
  RESTART_TEST: (testRunId, testId) => `/api/reporting/v1/test-runs/${testRunId}/tests/${testId}`,
  FINISH_TEST: (testRunId, testId) => `/api/reporting/v1/test-runs/${testRunId}/tests/${testId}`,
  REVERT_TEST_REGISTRATION: (testRunId, testId) => `/api/reporting/v1/test-runs/${testRunId}/tests/${testId}`,

  START_TEST_SESSION: (testRunId) => `/api/reporting/v1/test-runs/${testRunId}/test-sessions`,
  UPDATE_TEST_SESSION: (testRunId, testSessionId) =>
    `/api/reporting/v1/test-runs/${testRunId}/test-sessions/${testSessionId}`,
  FINISH_TEST_SESSION: (testRunId, testSessionId) =>
    `/api/reporting/v1/test-runs/${testRunId}/test-sessions/${testSessionId}`,

  UPDATE_TCM_CONFIGS: (testRunId) => `/api/reporting/v1/test-runs/${testRunId}/tcm-configs`,
  UPSERT_TEST_TEST_CASES: (testRunId, testId) =>
    `/api/reporting/v1/test-runs/${testRunId}/tests/${testId}/test-cases:upsert`,

  UPLOAD_SCREENSHOT: (testRunId, testId) => `/api/reporting/v1/test-runs/${testRunId}/tests/${testId}/screenshots`,
  SEND_LOGS: (testRunId) => `/api/reporting/v1/test-runs/${testRunId}/logs`,

  ATTACH_TEST_RUN_LABELS: (testRunId) => `/api/reporting/v1/test-runs/${testRunId}/labels`,
  ATTACH_TEST_LABELS: (testRunId, testId) => `/api/reporting/v1/test-runs/${testRunId}/tests/${testId}/labels`,

  ATTACH_TEST_RUN_ARTIFACT_REFERENCES: (testRunId) => `/api/reporting/v1/test-runs/${testRunId}/artifact-references`,
  ATTACH_TEST_ARTIFACT_REFERENCES: (testRunId, testId) =>
    `/api/reporting/v1/test-runs/${testRunId}/tests/${testId}/artifact-references`,

  UPLOAD_TEST_RUN_ARTIFACT: (testRunId) => `/api/reporting/v1/test-runs/${testRunId}/artifacts`,
  UPLOAD_TEST_ARTIFACT: (testRunId, testId) => `/api/reporting/v1/test-runs/${testRunId}/tests/${testId}/artifacts`,
  UPLOAD_TEST_SESSION_ARTIFACT: (testRunId, testSessionId) =>
    `/api/reporting/v1/test-runs/${testRunId}/test-sessions/${testSessionId}/artifacts`,
};
