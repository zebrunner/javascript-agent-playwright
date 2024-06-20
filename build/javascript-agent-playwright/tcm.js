"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.zephyr = exports.xray = exports.testRail = exports.zebrunner = void 0;
const events_1 = require("./constants/events");
const helpers_1 = require("./helpers");
const emitAddTestCaseEvent = (tcmType, tcmName, methodName, testCaseKey, resultStatus) => {
    if ((0, helpers_1.isNotBlankString)(testCaseKey)) {
        const testCase = {
            tcmType: tcmType,
            testCaseId: testCaseKey,
            resultStatus: resultStatus,
        };
        process.stdout.write(JSON.stringify({ eventType: events_1.EVENT_NAMES.ATTACH_TEST_CASE, payload: testCase }));
    }
    else {
        (0, helpers_1.stdoutErrorEvent)(`${tcmName}.${methodName}`, `Test Case key must be a not blank string. Provided value is '${testCaseKey}'`);
    }
};
exports.zebrunner = {
    testCaseKey: (...testCaseKeys) => {
        if ((0, helpers_1.isNotEmptyArray)(testCaseKeys)) {
            testCaseKeys.forEach((testCaseKey) => emitAddTestCaseEvent('ZEBRUNNER', 'zebrunner', 'testCaseKey', testCaseKey));
        }
    },
    testCaseStatus: (testCaseKey, resultStatus) => {
        emitAddTestCaseEvent('ZEBRUNNER', 'zebrunner', 'testCaseStatus', testCaseKey, resultStatus);
    },
};
const emitTestRailAddTestCaseEvent = (methodName, testCaseId, resultStatus) => {
    if ((0, helpers_1.isNotBlankString)(testCaseId) && testCaseId.startsWith('C')) {
        testCaseId = testCaseId.substring(1);
    }
    emitAddTestCaseEvent('TEST_RAIL', 'testRail', methodName, testCaseId, resultStatus);
};
exports.testRail = {
    testCaseId: (...testCaseIds) => {
        if ((0, helpers_1.isNotEmptyArray)(testCaseIds)) {
            testCaseIds.forEach((testCaseId) => emitTestRailAddTestCaseEvent('testCaseId', testCaseId));
        }
    },
    testCaseStatus: (testCaseId, resultStatus) => {
        emitTestRailAddTestCaseEvent('testCaseStatus', testCaseId, resultStatus);
    },
};
exports.xray = {
    testCaseKey: (...testCaseKeys) => {
        if ((0, helpers_1.isNotEmptyArray)(testCaseKeys)) {
            testCaseKeys.forEach((testCaseKey) => emitAddTestCaseEvent('XRAY', 'xray', 'testCaseKey', testCaseKey));
        }
    },
    testCaseStatus: (testCaseKey, resultStatus) => {
        emitAddTestCaseEvent('XRAY', 'xray', 'testCaseKey', testCaseKey, resultStatus);
    },
};
exports.zephyr = {
    testCaseKey: (...testCaseKeys) => {
        if ((0, helpers_1.isNotEmptyArray)(testCaseKeys)) {
            testCaseKeys.forEach((testCaseKey) => emitAddTestCaseEvent('ZEPHYR', 'zephyr', 'testCaseKey', testCaseKey));
        }
    },
    testCaseStatus: (testCaseKey, resultStatus) => {
        emitAddTestCaseEvent('ZEPHYR', 'zephyr', 'testCaseKey', testCaseKey, resultStatus);
    },
};
//# sourceMappingURL=tcm.js.map