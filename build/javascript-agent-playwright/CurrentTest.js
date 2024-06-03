"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CurrentTest = void 0;
const loglevel_1 = __importDefault(require("loglevel"));
const events_1 = require("./constants/events");
const helpers_1 = require("./helpers");
const logger = loglevel_1.default.getLogger('zebrunner');
exports.CurrentTest = {
    setMaintainer: (maintainer) => {
        if ((0, helpers_1.isNotBlankString)(maintainer)) {
            const eventType = events_1.EVENT_NAMES.SET_MAINTAINER;
            const payload = JSON.stringify({ eventType, payload: maintainer });
            process.stdout.write(payload);
        }
        else {
            logger.warn(`Maintainer must be a not blank string. Provided value is '${maintainer}'`);
        }
    },
    addLog: (message) => {
        if ((0, helpers_1.isNotBlankString)(message)) {
            const eventType = events_1.EVENT_NAMES.ADD_TEST_LOG;
            const payload = JSON.stringify({ eventType, payload: { message, timestamp: new Date().getTime() } });
            process.stdout.write(payload);
        }
        else {
            logger.warn(`Message must be a not blank string. Provided value is '${message}'`);
        }
    },
    attachLabel: (key, ...values) => {
        if (!(0, helpers_1.isNotBlankString)(key)) {
            logger.warn(`Label key must be a not blank string. Provided value is '${key}'`);
            return;
        }
        if (!(0, helpers_1.isNotEmptyArray)(values)) {
            logger.warn(`You must provide at least one label value. The label with the key '${key}' has none`);
            return;
        }
        values = values.filter((value) => {
            const isNotBlank = (0, helpers_1.isNotBlankString)(value);
            if (!isNotBlank) {
                logger.warn(`Label value must be a not blank string. Provided value for key '${key}' is '${value}'`);
            }
            return isNotBlank;
        });
        if ((0, helpers_1.isNotEmptyArray)(values)) {
            const eventType = events_1.EVENT_NAMES.ATTACH_TEST_LABELS;
            const payload = JSON.stringify({ eventType, payload: { key, values } });
            process.stdout.write(payload);
        }
    },
    attachArtifactReference: (name, value) => {
        if (!(0, helpers_1.isNotBlankString)(name)) {
            logger.warn(`Artifact reference name must be a not blank string. Provided value is '${name}'`);
            return;
        }
        if (!(0, helpers_1.isNotBlankString)(value)) {
            logger.warn(`Artifact reference value must be a not blank string. Provided value for name '${value}' is '${value}'`);
            return;
        }
        const eventType = events_1.EVENT_NAMES.ATTACH_TEST_ARTIFACT_REFERENCES;
        const payload = JSON.stringify({ eventType, payload: { name, value } });
        process.stdout.write(payload);
    },
    revertRegistration: () => {
        const eventType = events_1.EVENT_NAMES.REVERT_TEST_REGISTRATION;
        process.stdout.write(JSON.stringify({ eventType }));
    },
};
//# sourceMappingURL=CurrentTest.js.map