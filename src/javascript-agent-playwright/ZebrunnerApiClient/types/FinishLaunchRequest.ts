export class FinishLaunchRequest {
  endedAt: Date;

  constructor() {
    this.endedAt = new Date();
  }
}
