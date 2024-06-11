import { TestCase as PwTestCase } from '@playwright/test/reporter';

export type LogLevel = 'INFO' | 'ERROR' | 'WARN' | 'FATAL' | 'DEBUG' | 'TRACE' | string;

export type TestStep = {
  level: LogLevel;
  timestamp: number;
  message: string;
  testId?: number;
};

export type TcmType = 'TEST_RAIL' | 'ZEPHYR' | 'XRAY' | 'ZEBRUNNER';

export interface ZbrTestCase {
  tcmType: TcmType;
  testCaseId: string;
  resultStatus?: string;
}

export type FileArtifact = {
  timestamp: Date;
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
  customLogs: TestStep[];
  customArtifacts: FileArtifact[];
}
