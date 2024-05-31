"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportingConfig = void 0;
const helpers_1 = require("../helpers");
function getString(envVar, configValue, defaultValue = null) {
    const value = process.env[envVar];
    return (0, helpers_1.isNotBlankString)(value) ? value : (0, helpers_1.isNotBlankString)(configValue) ? configValue : defaultValue;
}
function getBoolean(envVar, configValue, defaultValue = false) {
    return (process.env[envVar]?.toLowerCase?.() === 'true' ||
        configValue === true ||
        configValue?.toLowerCase?.() === 'true' ||
        defaultValue);
}
function getNumber(envVar, configValue, defaultValue = null) {
    return parseInt(process.env[envVar], 10) || parseInt(configValue, 10) || defaultValue;
}
class ReportingConfig {
    enabled;
    projectKey;
    server;
    launch;
    milestone;
    notifications;
    tcm;
    constructor(config) {
        this.enabled = getBoolean('REPORTING_ENABLED', config?.enabled);
        this.projectKey = getString('REPORTING_PROJECT_KEY', config?.projectKey, 'DEF');
        this.server = {
            hostname: getString('REPORTING_SERVER_HOSTNAME', config?.server?.hostname),
            accessToken: getString('REPORTING_SERVER_ACCESS_TOKEN', config?.server?.accessToken),
        };
        if (this.enabled === true && !this.server.hostname && !this.server.accessToken) {
            throw new Error('When reporting is enabled, you must provide Zebrunner hostname and accessToken');
        }
        this.launch = {
            displayName: getString('REPORTING_RUN_DISPLAY_NAME', config?.launch?.displayName, process.env.npm_package_name),
            build: getString('REPORTING_RUN_BUILD', config?.launch?.build),
            environment: getString('REPORTING_RUN_ENVIRONMENT', config?.launch?.environment),
        };
        this.milestone = {
            id: getNumber('REPORTING_MILESTONE_ID', config?.milestone?.id),
            name: getString('REPORTING_MILESTONE_NAME', config?.milestone?.name),
        };
        this.notifications = {
            notifyOnEachFailure: getBoolean('REPORTING_NOTIFICATION_NOTIFY_ON_EACH_FAILURE', config?.notifications?.notifyOnEachFailure),
            slackChannels: getString('REPORTING_NOTIFICATION_SLACK_CHANNELS', config?.notifications?.slackChannels),
            teamsChannels: getString('REPORTING_NOTIFICATION_MS_TEAMS_CHANNELS', config?.notifications?.teamsChannels),
            emails: getString('REPORTING_NOTIFICATION_EMAILS', config?.notifications?.emails),
        };
        this.tcm = {
            testCaseStatus: {
                onPass: getString('REPORTING_TCM_TEST_CASE_STATUS_ON_PASS', config?.tcm?.testCaseStatus?.onPass),
                onFail: getString('REPORTING_TCM_TEST_CASE_STATUS_ON_FAIL', config?.tcm?.testCaseStatus?.onFail),
            },
            zebrunner: {
                pushResults: getBoolean('REPORTING_TCM_ZEBRUNNER_PUSH_RESULTS', config?.tcm?.zebrunner?.pushResults),
                pushInRealTime: getBoolean('REPORTING_TCM_ZEBRUNNER_PUSH_IN_REAL_TIME', config?.tcm?.zebrunner?.pushInRealTime),
                testRunId: getNumber('REPORTING_TCM_ZEBRUNNER_TEST_RUN_ID', config?.tcm?.zebrunner?.testRunId),
            },
            testRail: {
                pushResults: getBoolean('REPORTING_TCM_TESTRAIL_PUSH_RESULTS', config?.tcm?.testRail?.pushResults),
                pushInRealTime: getBoolean('REPORTING_TCM_TESTRAIL_PUSH_IN_REAL_TIME', config?.tcm?.testRail?.pushInRealTime),
                suiteId: getNumber('REPORTING_TCM_TESTRAIL_SUITE_ID', config?.tcm?.testRail?.suiteId),
                runId: getNumber('REPORTING_TCM_TESTRAIL_RUN_ID', config?.tcm?.testRail?.runId),
                includeAllTestCasesInNewRun: getBoolean('REPORTING_TCM_TESTRAIL_INCLUDE_ALL_IN_NEW_RUN', config?.tcm?.testRail?.includeAllTestCasesInNewRun),
                runName: getString('REPORTING_TCM_TESTRAIL_RUN_NAME', config?.tcm?.testRail?.runName),
                milestoneName: getString('REPORTING_TCM_TESTRAIL_MILESTONE_NAME', config?.tcm?.testRail?.milestoneName),
                assignee: getString('REPORTING_TCM_TESTRAIL_ASSIGNEE', config?.tcm?.testRail?.assignee),
            },
            xray: {
                pushResults: getBoolean('REPORTING_TCM_XRAY_PUSH_RESULTS', config?.tcm?.xray?.pushResults),
                pushInRealTime: getBoolean('REPORTING_TCM_XRAY_PUSH_IN_REAL_TIME', config?.tcm?.xray?.pushInRealTime),
                executionKey: getString('REPORTING_TCM_XRAY_EXECUTION_KEY', config?.tcm?.xray?.executionKey),
            },
            zephyr: {
                pushResults: getBoolean('REPORTING_TCM_ZEPHYR_PUSH_RESULTS', config?.tcm?.zephyr?.pushResults),
                pushInRealTime: getBoolean('REPORTING_TCM_ZEPHYR_PUSH_IN_REAL_TIME', config?.tcm?.zephyr?.pushInRealTime),
                jiraProjectKey: getString('REPORTING_TCM_ZEPHYR_JIRA_PROJECT_KEY', config?.tcm?.zephyr?.jiraProjectKey),
                testCycleKey: getString('REPORTING_TCM_ZEPHYR_TEST_CYCLE_KEY', config?.tcm?.zephyr?.testCycleKey),
            },
        };
    }
}
exports.ReportingConfig = ReportingConfig;
//# sourceMappingURL=ReportingConfig.js.map