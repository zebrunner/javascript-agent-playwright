import { EVENT_NAMES } from './constants/events';
import { isNotBlankString, isNotEmptyArray, stdoutErrorEvent } from './helpers';
import { TcmType, ZbrTestCase } from './types';

const emitAddTestCaseEvent = (
  tcmType: TcmType,
  tcmName: string,
  methodName: string,
  testCaseKey: string,
  resultStatus?: string,
) => {
  if (isNotBlankString(testCaseKey)) {
    const testCase: ZbrTestCase = {
      tcmType: tcmType,
      testCaseId: testCaseKey,
      resultStatus: resultStatus,
    };

    process.stdout.write(JSON.stringify({ eventType: EVENT_NAMES.ATTACH_TEST_CASE, payload: testCase }));
  } else {
    stdoutErrorEvent(
      `${tcmName}.${methodName}`,
      `Test Case key must be a not blank string. Provided value is '${testCaseKey}'`,
    );
  }
};

export const zebrunner = {
  testCaseKey: (...testCaseKeys: string[]) => {
    if (isNotEmptyArray(testCaseKeys)) {
      testCaseKeys.forEach((testCaseKey: string) =>
        emitAddTestCaseEvent('ZEBRUNNER', 'zebrunner', 'testCaseKey', testCaseKey),
      );
    }
  },

  testCaseStatus: (testCaseKey: string, resultStatus: string) => {
    emitAddTestCaseEvent('ZEBRUNNER', 'zebrunner', 'testCaseStatus', testCaseKey, resultStatus);
  },
};

const emitTestRailAddTestCaseEvent = (methodName: string, testCaseId: string, resultStatus?: string) => {
  if (isNotBlankString(testCaseId) && testCaseId.startsWith('C')) {
    testCaseId = testCaseId.substring(1);
  }
  emitAddTestCaseEvent('TEST_RAIL', 'testRail', methodName, testCaseId, resultStatus);
};

export const testRail = {
  testCaseId: (...testCaseIds: string[]) => {
    if (isNotEmptyArray(testCaseIds)) {
      testCaseIds.forEach((testCaseId: string) => emitTestRailAddTestCaseEvent('testCaseId', testCaseId));
    }
  },

  testCaseStatus: (testCaseId: string, resultStatus: string) => {
    emitTestRailAddTestCaseEvent('testCaseStatus', testCaseId, resultStatus);
  },
};

export const xray = {
  testCaseKey: (...testCaseKeys: string[]) => {
    if (isNotEmptyArray(testCaseKeys)) {
      testCaseKeys.forEach((testCaseKey: string) => emitAddTestCaseEvent('XRAY', 'xray', 'testCaseKey', testCaseKey));
    }
  },

  testCaseStatus: (testCaseKey: string, resultStatus: string) => {
    emitAddTestCaseEvent('XRAY', 'xray', 'testCaseKey', testCaseKey, resultStatus);
  },
};

export const zephyr = {
  testCaseKey: (...testCaseKeys: string[]) => {
    if (isNotEmptyArray(testCaseKeys)) {
      testCaseKeys.forEach((testCaseKey: string) =>
        emitAddTestCaseEvent('ZEPHYR', 'zephyr', 'testCaseKey', testCaseKey),
      );
    }
  },

  testCaseStatus: (testCaseKey: string, resultStatus: string) => {
    emitAddTestCaseEvent('ZEPHYR', 'zephyr', 'testCaseKey', testCaseKey, resultStatus);
  },
};
