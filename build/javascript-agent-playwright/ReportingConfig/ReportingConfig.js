"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportingConfig = void 0;
const helpers_1 = require("../helpers");
const helpers_2 = require("./helpers");
class ReportingConfig {
    enabled;
    projectKey;
    server;
    launch;
    logs;
    milestone;
    notifications;
    tcm;
    constructor(config) {
        this.enabled = (0, helpers_2.getBoolean)('REPORTING_ENABLED', config?.enabled);
        this.projectKey = (0, helpers_2.getString)('REPORTING_PROJECT_KEY', config?.projectKey, 'DEF');
        this.server = {
            hostname: (0, helpers_2.getString)('REPORTING_SERVER_HOSTNAME', config?.server?.hostname),
            accessToken: (0, helpers_2.getString)('REPORTING_SERVER_ACCESS_TOKEN', config?.server?.accessToken),
        };
        if (this.enabled === true && !this.server.hostname && !this.server.accessToken) {
            throw new Error('When reporting is enabled, you must provide Zebrunner hostname and accessToken');
        }
        this.launch = {
            displayName: (0, helpers_2.getString)('REPORTING_LAUNCH_DISPLAY_NAME', config?.launch?.displayName, (0, helpers_1.isNotBlankString)(process.env.npm_package_name) ? process.env.npm_package_name : 'Default Suite'),
            build: (0, helpers_2.getString)('REPORTING_LAUNCH_BUILD', config?.launch?.build),
            environment: (0, helpers_2.getString)('REPORTING_LAUNCH_ENVIRONMENT', config?.launch?.environment),
            locale: (0, helpers_2.getString)('REPORTING_LAUNCH_LOCALE', config?.launch?.locale),
            treatSkipsAsFailures: (0, helpers_2.getBoolean)('REPORTING_LAUNCH_TREAT_SKIPS_AS_FAILURES', config?.launch?.treatSkipsAsFailures, true),
        };
        this.logs = {
            ignorePlaywrightSteps: (0, helpers_2.getBoolean)('REPORTING_LOGS_IGNORE_PLAYWRIGHT_STEPS', config?.logs?.ignorePlaywrightSteps, false),
            useLinesFromSourceCode: (0, helpers_2.getBoolean)('REPORTING_LOGS_USE_LINES_FROM_SOURCE_CODE', config?.logs?.useLinesFromSourceCode, true),
            ignoreConsole: (0, helpers_2.getBoolean)('REPORTING_LOGS_IGNORE_CONSOLE', config?.logs?.ignoreConsole, false),
            ignoreCustom: (0, helpers_2.getBoolean)('REPORTING_LOGS_IGNORE_MANUAL', config?.logs?.ignoreCustom, false),
            ignoreManualScreenshots: (0, helpers_2.getBoolean)('REPORTING_LOGS_IGNORE_CUSTOM_SCREENSHOTS', config?.logs?.ignoreManualScreenshots, false),
            ignoreAutoScreenshots: (0, helpers_2.getBoolean)('REPORTING_LOGS_IGNORE_AUTO_SCREENSHOTS', config?.logs?.ignoreAutoScreenshots, false),
        };
        this.milestone = {
            idFromConfig: config?.milestone?.id,
            idFromEnv: (0, helpers_2.getNumber)('REPORTING_MILESTONE_ID', null),
            nameFromConfig: config?.milestone?.name,
            nameFromEnv: (0, helpers_2.getString)('REPORTING_MILESTONE_NAME', null),
        };
        this.notifications = {
            notifyOnEachFailure: (0, helpers_2.getBoolean)('REPORTING_NOTIFICATION_NOTIFY_ON_EACH_FAILURE', config?.notifications?.notifyOnEachFailure),
            slackChannels: (0, helpers_2.getString)('REPORTING_NOTIFICATION_SLACK_CHANNELS', config?.notifications?.slackChannels),
            teamsChannels: (0, helpers_2.getString)('REPORTING_NOTIFICATION_MS_TEAMS_CHANNELS', config?.notifications?.teamsChannels),
            emails: (0, helpers_2.getString)('REPORTING_NOTIFICATION_EMAILS', config?.notifications?.emails),
        };
        this.tcm = {
            testCaseStatus: {
                onPass: (0, helpers_2.getString)('REPORTING_TCM_TEST_CASE_STATUS_ON_PASS', config?.tcm?.testCaseStatus?.onPass),
                onFail: (0, helpers_2.getString)('REPORTING_TCM_TEST_CASE_STATUS_ON_FAIL', config?.tcm?.testCaseStatus?.onFail),
                onSkip: (0, helpers_2.getString)('REPORTING_TCM_TEST_CASE_STATUS_ON_SKIP', config?.tcm?.testCaseStatus?.onSkip),
            },
            zebrunner: {
                pushResults: (0, helpers_2.getBoolean)('REPORTING_TCM_ZEBRUNNER_PUSH_RESULTS', config?.tcm?.zebrunner?.pushResults),
                pushInRealTime: (0, helpers_2.getBoolean)('REPORTING_TCM_ZEBRUNNER_PUSH_IN_REAL_TIME', config?.tcm?.zebrunner?.pushInRealTime),
                testRunId: (0, helpers_2.getNumber)('REPORTING_TCM_ZEBRUNNER_TEST_RUN_ID', config?.tcm?.zebrunner?.testRunId),
            },
            testRail: {
                pushResults: (0, helpers_2.getBoolean)('REPORTING_TCM_TESTRAIL_PUSH_RESULTS', config?.tcm?.testRail?.pushResults),
                pushInRealTime: (0, helpers_2.getBoolean)('REPORTING_TCM_TESTRAIL_PUSH_IN_REAL_TIME', config?.tcm?.testRail?.pushInRealTime),
                suiteId: (0, helpers_2.getNumber)('REPORTING_TCM_TESTRAIL_SUITE_ID', config?.tcm?.testRail?.suiteId),
                runId: (0, helpers_2.getNumber)('REPORTING_TCM_TESTRAIL_RUN_ID', config?.tcm?.testRail?.runId),
                includeAllTestCasesInNewRun: (0, helpers_2.getBoolean)('REPORTING_TCM_TESTRAIL_INCLUDE_ALL_IN_NEW_RUN', config?.tcm?.testRail?.includeAllTestCasesInNewRun),
                runName: (0, helpers_2.getString)('REPORTING_TCM_TESTRAIL_RUN_NAME', config?.tcm?.testRail?.runName),
                milestoneName: (0, helpers_2.getString)('REPORTING_TCM_TESTRAIL_MILESTONE_NAME', config?.tcm?.testRail?.milestoneName),
                assignee: (0, helpers_2.getString)('REPORTING_TCM_TESTRAIL_ASSIGNEE', config?.tcm?.testRail?.assignee),
            },
            xray: {
                pushResults: (0, helpers_2.getBoolean)('REPORTING_TCM_XRAY_PUSH_RESULTS', config?.tcm?.xray?.pushResults),
                pushInRealTime: (0, helpers_2.getBoolean)('REPORTING_TCM_XRAY_PUSH_IN_REAL_TIME', config?.tcm?.xray?.pushInRealTime),
                executionKey: (0, helpers_2.getString)('REPORTING_TCM_XRAY_EXECUTION_KEY', config?.tcm?.xray?.executionKey),
            },
            zephyr: {
                pushResults: (0, helpers_2.getBoolean)('REPORTING_TCM_ZEPHYR_PUSH_RESULTS', config?.tcm?.zephyr?.pushResults),
                pushInRealTime: (0, helpers_2.getBoolean)('REPORTING_TCM_ZEPHYR_PUSH_IN_REAL_TIME', config?.tcm?.zephyr?.pushInRealTime),
                jiraProjectKey: (0, helpers_2.getString)('REPORTING_TCM_ZEPHYR_JIRA_PROJECT_KEY', config?.tcm?.zephyr?.jiraProjectKey),
                testCycleKey: (0, helpers_2.getString)('REPORTING_TCM_ZEPHYR_TEST_CYCLE_KEY', config?.tcm?.zephyr?.testCycleKey),
            },
        };
    }
}
exports.ReportingConfig = ReportingConfig;
//# sourceMappingURL=ReportingConfig.js.map