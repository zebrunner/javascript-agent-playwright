const xrayLabels = {
  SYNC_ENABLED: 'com.zebrunner.app/tcm.xray.sync.enabled',
  SYNC_REAL_TIME: 'com.zebrunner.app/tcm.xray.sync.real-time',
  EXECUTION_KEY: 'com.zebrunner.app/tcm.xray.test-execution-key',
  TEST_KEY: 'com.zebrunner.app/tcm.xray.test-key',
};

const testRailLabels = {
  SYNC_ENABLED: "com.zebrunner.app/tcm.testrail.sync.enabled",
  SYNC_REAL_TIME: "com.zebrunner.app/tcm.testrail.sync.real-time",
  INCLUDE_ALL: "com.zebrunner.app/tcm.testrail.include-all-cases",
  SUITE_ID: "com.zebrunner.app/tcm.testrail.suite-id",
  RUN_ID: "com.zebrunner.app/tcm.testrail.run-id",
  RUN_NAME: "com.zebrunner.app/tcm.testrail.run-name",
  MILESTONE: "com.zebrunner.app/tcm.testrail.milestone",
  ASSIGNEE: "com.zebrunner.app/tcm.testrail.assignee",
  CASE_ID: "com.zebrunner.app/tcm.testrail.case-id",
}

const zephyrLabels = {
  SYNC_ENABLED: "com.zebrunner.app/tcm.zephyr.sync.enabled",
  SYNC_REAL_TIME: "com.zebrunner.app/tcm.zephyr.sync.real-time",
  TEST_CYCLE_KEY: "com.zebrunner.app/tcm.zephyr.test-cycle-key",
  JIRA_PROJECT_KEY: "com.zebrunner.app/tcm.zephyr.jira-project-key",
  TEST_CASE_KEY: "com.zebrunner.app/tcm.zephyr.test-case-key",
}

const tcmEvents = {
  TCM_RUN_OPTIONS: 'TCM_RUN_OPTIONS',
  TCM_TEST_OPTIONS: 'TCM_TEST_OPTIONS',
  SET_MAINTAINER: 'SET_MAINTAINER'
}

export {
  xrayLabels,
  testRailLabels,
  zephyrLabels,
  tcmEvents,
};