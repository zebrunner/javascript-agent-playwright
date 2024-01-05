import { ReportingConfig } from '../reporting-config';
import { SummarySendingPolicy } from './summary-sending-policy';

export type NotificationTargetType = 'SLACK_CHANNELS' | 'MS_TEAMS_CHANNELS' | 'EMAIL_RECIPIENTS'
export type TestRunStartStatus = 'IN_PROGRESS' | 'QUEUED'
export type Framework = 'playwright'

export interface NotificationTarget {

    type: NotificationTargetType;
    value: string;

}

export class StartTestRunRequest {

    uuid?: string;
    name: string;
    startedAt: Date;
    status: TestRunStartStatus;
    framework: Framework;
    config?: {
        environment?: string
        build?: string
        treatSkipsAsFailures?: boolean
    };
    milestone?: {
        id?: number
        name?: string
    };
    notifications?: {
        notifyOnEachFailure?: boolean,
        summarySendingPolicy?: SummarySendingPolicy,
        targets: NotificationTarget[]
    };

    constructor(uuid: string, startedAt: Date, reportingConfig: ReportingConfig) {
        this.uuid = uuid;
        this.name = reportingConfig.launch.displayName;
        this.startedAt = startedAt;
        this.status = 'IN_PROGRESS';
        this.framework = 'playwright';
        this.config = {
            environment: reportingConfig.launch.environment,
            build: reportingConfig.launch.build
        };
        this.milestone = {
            id: reportingConfig.milestone.id,
            name: reportingConfig.milestone.name,
        };
        this.notifications = {
            notifyOnEachFailure: reportingConfig.notifications.notifyOnEachFailure,
            summarySendingPolicy: reportingConfig.notifications.summarySendingPolicy,
            targets: [
                {
                    type: 'SLACK_CHANNELS',
                    value: reportingConfig.notifications.slackChannels
                } as NotificationTarget,
                {
                    type: 'MS_TEAMS_CHANNELS',
                    value: reportingConfig.notifications.teamsChannels
                } as NotificationTarget,
                {
                    type: 'EMAIL_RECIPIENTS',
                    value: reportingConfig.notifications.emails
                } as NotificationTarget,
            ].filter((value) => value.value),
        };
    }

}
