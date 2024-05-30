"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.zephyr = exports.xray = exports.testRail = exports.zebrunner = void 0;
const loglevel_1 = __importDefault(require("loglevel"));
const events_1 = require("./constants/events");
const helpers_1 = require("./helpers");
const logger = loglevel_1.default.getLogger('zebrunner');
const emitAddTestCaseEvent = (tcmType, testCaseKey, resultStatus) => {
    if ((0, helpers_1.isNotBlankString)(testCaseKey)) {
        const testCase = {
            tcmType: tcmType,
            testCaseId: testCaseKey,
            resultStatus: resultStatus,
        };
        const eventType = events_1.EVENT_NAMES.ADD_TEST_CASE;
        const payload = JSON.stringify({ eventType, payload: testCase });
        process.stdout.write(payload);
    }
    else {
        logger.warn(`Test Case key must be a not blank string. Provided value is '${testCaseKey}'`);
    }
};
exports.zebrunner = {
    testCaseKey: (...testCaseKeys) => {
        if ((0, helpers_1.isNotEmptyArray)(testCaseKeys)) {
            testCaseKeys.forEach((testCaseKey) => emitAddTestCaseEvent('ZEBRUNNER', testCaseKey));
        }
    },
    testCaseStatus: (testCaseKey, resultStatus) => {
        emitAddTestCaseEvent('ZEBRUNNER', testCaseKey, resultStatus);
    },
};
const emitTestRailAddTestCaseEvent = (testCaseId, resultStatus) => {
    if ((0, helpers_1.isNotBlankString)(testCaseId) && testCaseId.startsWith('C')) {
        testCaseId = testCaseId.substring(1);
    }
    emitAddTestCaseEvent('TEST_RAIL', testCaseId, resultStatus);
};
exports.testRail = {
    testCaseId: (...testCaseIds) => {
        if ((0, helpers_1.isNotEmptyArray)(testCaseIds)) {
            testCaseIds.forEach((testCaseId) => emitTestRailAddTestCaseEvent(testCaseId));
        }
    },
    testCaseStatus: (testCaseId, resultStatus) => {
        emitTestRailAddTestCaseEvent(testCaseId, resultStatus);
    },
};
exports.xray = {
    testCaseKey: (...testCaseKeys) => {
        if ((0, helpers_1.isNotEmptyArray)(testCaseKeys)) {
            testCaseKeys.forEach((testCaseKey) => emitAddTestCaseEvent('XRAY', testCaseKey));
        }
    },
    testCaseStatus: (testCaseKey, resultStatus) => {
        emitAddTestCaseEvent('XRAY', testCaseKey, resultStatus);
    },
};
exports.zephyr = {
    testCaseKey: (...testCaseKeys) => {
        if ((0, helpers_1.isNotEmptyArray)(testCaseKeys)) {
            testCaseKeys.forEach((testCaseKey) => emitAddTestCaseEvent('ZEPHYR', testCaseKey));
        }
    },
    testCaseStatus: (testCaseKey, resultStatus) => {
        emitAddTestCaseEvent('ZEPHYR', testCaseKey, resultStatus);
    },
};
//# sourceMappingURL=tcm.js.map