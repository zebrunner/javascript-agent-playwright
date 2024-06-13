export const ZEBRUNNER_PATHS = {
  REFRESH_TOKEN: () => '/api/iam/v1/auth/refresh',
  EXCHANGE_LAUNCH_CONTEXT: () => '/api/reporting/v1/run-context-exchanges',

  START_LAUNCH: () => '/api/reporting/v1/test-runs',
  FINISH_LAUNCH: (launchId) => `/api/reporting/v1/test-runs/${launchId}`,

  START_TEST: (launchId) => `/api/reporting/v1/test-runs/${launchId}/tests`,
  UPDATE_TEST: (launchId, testId) => `/api/reporting/v1/test-runs/${launchId}/tests/${testId}`,
  RESTART_TEST: (launchId, testId) => `/api/reporting/v1/test-runs/${launchId}/tests/${testId}`,
  FINISH_TEST: (launchId, testId) => `/api/reporting/v1/test-runs/${launchId}/tests/${testId}`,
  REVERT_TEST_REGISTRATION: (launchId, testId) => `/api/reporting/v1/test-runs/${launchId}/tests/${testId}`,

  START_TEST_SESSION: (launchId) => `/api/reporting/v1/test-runs/${launchId}/test-sessions`,
  UPDATE_TEST_SESSION: (launchId, testSessionId) =>
    `/api/reporting/v1/test-runs/${launchId}/test-sessions/${testSessionId}`,
  FINISH_TEST_SESSION: (launchId, testSessionId) =>
    `/api/reporting/v1/test-runs/${launchId}/test-sessions/${testSessionId}`,

  UPDATE_TCM_CONFIGS: (launchId) => `/api/reporting/v1/test-runs/${launchId}/tcm-configs`,
  UPSERT_TEST_TEST_CASES: (launchId, testId) =>
    `/api/reporting/v1/test-runs/${launchId}/tests/${testId}/test-cases:upsert`,

  UPLOAD_SCREENSHOT: (launchId, testId) => `/api/reporting/v1/test-runs/${launchId}/tests/${testId}/screenshots`,
  SEND_LOGS: (launchId) => `/api/reporting/v1/test-runs/${launchId}/logs`,

  ATTACH_LAUNCH_LABELS: (launchId) => `/api/reporting/v1/test-runs/${launchId}/labels`,
  ATTACH_TEST_LABELS: (launchId, testId) => `/api/reporting/v1/test-runs/${launchId}/tests/${testId}/labels`,

  ATTACH_LAUNCH_ARTIFACT_REFERENCES: (launchId) => `/api/reporting/v1/test-runs/${launchId}/artifact-references`,
  ATTACH_TEST_ARTIFACT_REFERENCES: (launchId, testId) =>
    `/api/reporting/v1/test-runs/${launchId}/tests/${testId}/artifact-references`,

  UPLOAD_LAUNCH_ARTIFACT: (launchId) => `/api/reporting/v1/test-runs/${launchId}/artifacts`,
  UPLOAD_TEST_ARTIFACT: (launchId, testId) => `/api/reporting/v1/test-runs/${launchId}/tests/${testId}/artifacts`,
  UPLOAD_TEST_SESSION_ARTIFACT: (launchId, testSessionId) =>
    `/api/reporting/v1/test-runs/${launchId}/test-sessions/${testSessionId}/artifacts`,
};
