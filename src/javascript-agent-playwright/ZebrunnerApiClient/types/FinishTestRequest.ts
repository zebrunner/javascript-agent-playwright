export interface FinishTestRequest {
  result: 'PASSED' | 'FAILED' | 'ABORTED' | 'SKIPPED';
  endedAt: Date;
  maintainer?: string;
  reason?: string;
}
