import { TestCase as PwTestCase } from '@playwright/test/reporter';

export type LogLevel = 'INFO' | 'ERROR' | 'WARN' | 'FATAL' | 'DEBUG' | 'TRACE' | string;
export type LogFormat = 'structured' | 'playwright-title' | 'source-line';

export type TestLogOptions = {
  ignorePlaywrightSteps: boolean;
  includeHooks: boolean;
  includeFixtures: boolean;
  includeBridgeActions: boolean;
  format: LogFormat;
  includeDuration: boolean;
  includeLocation: boolean;
  maxSourceLines: number;
  maxMessageLength: number;
  // Set while a test is still running: a step's duration and error are not final until it ends.
  onlyCompletedSteps?: boolean;
};

export type TestLog = {
  level: LogLevel;
  timestamp: number;
  message: string;
  type: 'log' | 'screenshot';
  testId: number;
  screenshotPathOrBuffer?: string | Buffer;
  deleteAfterUpload?: boolean;
  isPwTestStep?: boolean;
};

export type TcmType = 'TEST_RAIL' | 'ZEPHYR' | 'XRAY' | 'ZEBRUNNER';

export interface ZbrTestCase {
  tcmType: TcmType;
  testCaseId: string;
  resultStatus?: string;
}

export type FileArtifact = {
  timestamp: number;
  pathOrBuffer: string | Buffer;
  name?: string;
  contentType?: string;
  deleteAfterUpload?: boolean;
  fingerprint?: string;
};

export type StructuredAction = {
  id: string;
  kind: 'playwright' | 'bridge' | 'appium' | 'fixture';
  method: string;
  params?: unknown;
  startedAt: number;
  endedAt?: number;
  status: 'started' | 'passed' | 'failed';
  error?: string;
  source?: { file?: string; line?: number; column?: number };
};

export interface ExtendedPwTestCase extends PwTestCase {
  _projectId?: string;
}
