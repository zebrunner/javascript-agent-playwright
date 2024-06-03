export interface StartTestSessionRequest {
  desiredCapabilities: any;
  capabilities: any;
  sessionId?: string;
  initiatedAt: Date;
  startedAt?: Date;
  failureReason?: string;
  status?: 'RUNNING' | 'FAILED';
  testIds?: number[];
}
