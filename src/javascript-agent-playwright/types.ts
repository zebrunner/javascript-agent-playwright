import { TestCase as PwTestCase } from '@playwright/test/reporter';

export type LogLevel = 'INFO' | 'ERROR' | 'WARN' | 'FATAL' | 'DEBUG' | 'TRACE' | string;

export type TestLog = {
  level: LogLevel;
  timestamp: number;
  message: string;
  type: 'log' | 'screenshot';
  testId: number;
  screenshotPathOrBuffer?: string | Buffer;
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
};

export interface ExtendedPwTestCase extends PwTestCase {
  maintainer: string;
  testCases: ZbrTestCase[];
  labels: { key: string; value: string }[];
  shouldBeReverted: boolean;
  artifactReferences: { name: string; value: string }[];
  customArtifacts: FileArtifact[];
}
