export interface StartTestRequest {
  name: string;
  className: string;
  methodName: string;
  argumentsIndex?: number;
  startedAt: Date;
  maintainer?: string;
  correlationData?: string;
  testGroups?: string[];
}
