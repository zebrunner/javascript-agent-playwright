import { TestCase as PwTestCase} from '@playwright/test/reporter';

export type TestStep = {
  // refactor
  level: 'INFO' | 'ERROR';
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

export interface ExtendedPwTestCase extends PwTestCase {
  maintainer: string;
  testCases: ZbrTestCase[];
}
