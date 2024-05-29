export class FinishTestRequest {
  result: 'PASSED' | 'FAILED' | 'ABORTED' | 'SKIPPED';
  reason?: string;
  endedAt: Date;
}
