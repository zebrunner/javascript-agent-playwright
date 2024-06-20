"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StartLaunchRequest = void 0;
class StartLaunchRequest {
    uuid;
    name;
    startedAt;
    status;
    framework;
    config;
    milestone;
    notifications;
    constructor(uuid, startedAt, reportingConfig) {
        this.uuid = uuid;
        this.name = reportingConfig.launch.displayName;
        this.startedAt = startedAt;
        this.status = 'IN_PROGRESS';
        this.framework = 'playwright';
        this.config = {
            environment: reportingConfig.launch.environment,
            build: reportingConfig.launch.build,
            treatSkipsAsFailures: reportingConfig.launch.treatSkipsAsFailures,
        };
        this.milestone = {
            // priorities: env var id > env var name > cfg var id > cfg var name
            id: reportingConfig.milestone.idFromEnv
                ? reportingConfig.milestone.idFromEnv
                : reportingConfig.milestone.nameFromEnv
                    ? null
                    : reportingConfig.milestone.idFromConfig,
            name: reportingConfig.milestone.nameFromEnv || reportingConfig.milestone.nameFromConfig,
        };
        this.notifications = {
            notifyOnEachFailure: reportingConfig.notifications.notifyOnEachFailure,
            targets: [
                {
                    type: 'SLACK_CHANNELS',
                    value: reportingConfig.notifications.slackChannels,
                },
                {
                    type: 'MS_TEAMS_CHANNELS',
                    value: reportingConfig.notifications.teamsChannels,
                },
                {
                    type: 'EMAIL_RECIPIENTS',
                    value: reportingConfig.notifications.emails,
                },
            ].filter((value) => value.value),
        };
    }
}
exports.StartLaunchRequest = StartLaunchRequest;
//# sourceMappingURL=StartLaunchRequest.js.map