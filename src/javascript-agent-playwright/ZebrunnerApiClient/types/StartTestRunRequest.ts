import { ReportingConfig } from '../../ReportingConfig';

export type NotificationTargetType = 'SLACK_CHANNELS' | 'MS_TEAMS_CHANNELS' | 'EMAIL_RECIPIENTS';
export type TestRunStartStatus = 'IN_PROGRESS' | 'QUEUED';
export type Framework = 'playwright';

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
    environment?: string;
    build?: string;
    treatSkipsAsFailures?: boolean;
  };
  milestone?: {
    id?: number;
    name?: string;
  };
  notifications?: {
    notifyOnEachFailure?: boolean;
    targets: NotificationTarget[];
  };

  constructor(uuid: string, startedAt: Date, reportingConfig: ReportingConfig) {
    this.uuid = uuid;
    this.name = reportingConfig.launch.displayName;
    this.startedAt = startedAt;
    this.status = 'IN_PROGRESS';
    this.framework = 'playwright';
    this.config = {
      environment: reportingConfig.launch.environment,
      build: reportingConfig.launch.build,
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
        } as NotificationTarget,
        {
          type: 'MS_TEAMS_CHANNELS',
          value: reportingConfig.notifications.teamsChannels,
        } as NotificationTarget,
        {
          type: 'EMAIL_RECIPIENTS',
          value: reportingConfig.notifications.emails,
        } as NotificationTarget,
      ].filter((value) => value.value),
    };
  }
}
