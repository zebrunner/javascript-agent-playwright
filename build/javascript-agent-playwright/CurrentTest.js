"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CurrentTest = void 0;
const events_1 = require("./constants/events");
const helpers_1 = require("./helpers");
const fs_1 = __importDefault(require("fs"));
exports.CurrentTest = {
    setMaintainer: (maintainer) => {
        if ((0, helpers_1.isNotBlankString)(maintainer)) {
            process.stdout.write(JSON.stringify({ eventType: events_1.EVENT_NAMES.ATTACH_TEST_MAINTAINER, payload: maintainer }));
        }
        else {
            (0, helpers_1.stdoutErrorEvent)('CurrentTest.setMaintainer', `Maintainer must not be a blank string. Provided value is '${maintainer}'`);
        }
    },
    addLog: (message, level = 'INFO') => {
        if ((0, helpers_1.isNotBlankString)(message) && (0, helpers_1.isNotBlankString)(level)) {
            process.stdout.write(JSON.stringify({
                eventType: events_1.EVENT_NAMES.ATTACH_TEST_LOG,
                payload: { message, timestamp: new Date().getTime(), level },
            }));
        }
        else {
            (0, helpers_1.stdoutErrorEvent)('CurrentTest.addLog', `Message and level parameters must not be a blank string, provided parameters are '${message}' and '${level}'.`);
        }
    },
    attachLabel: (key, ...values) => {
        if (!(0, helpers_1.isNotBlankString)(key)) {
            (0, helpers_1.stdoutErrorEvent)('CurrentTest.attachLabel', `Label key must not be a blank string. Provided value is '${key}'`);
            return;
        }
        if (!(0, helpers_1.isNotEmptyArray)(values)) {
            (0, helpers_1.stdoutErrorEvent)('CurrentTest.attachLabel', `You must provide at least one label value. The label with the key '${key}' has none`);
            return;
        }
        values = values.filter((value) => {
            const isNotBlank = (0, helpers_1.isNotBlankString)(value);
            if (!isNotBlank) {
                (0, helpers_1.stdoutErrorEvent)('CurrentTest.attachLabel', `Label value must not be a blank string. Provided value for key '${key}' is '${value}'`);
            }
            return isNotBlank;
        });
        if ((0, helpers_1.isNotEmptyArray)(values)) {
            process.stdout.write(JSON.stringify({ eventType: events_1.EVENT_NAMES.ATTACH_TEST_LABELS, payload: { key, values } }));
        }
    },
    attachArtifactReference: (name, value) => {
        if (!(0, helpers_1.isNotBlankString)(name)) {
            (0, helpers_1.stdoutErrorEvent)('CurrentTest.attachArtifactReference', `Artifact reference name must not be a blank string. Provided value is '${name}'`);
            return;
        }
        if (!(0, helpers_1.isNotBlankString)(value)) {
            (0, helpers_1.stdoutErrorEvent)('CurrentTest.attachArtifactReference', `Artifact reference value must not be a blank string. Provided value for name '${value}' is '${value}'`);
            return;
        }
        process.stdout.write(JSON.stringify({ eventType: events_1.EVENT_NAMES.ATTACH_TEST_ARTIFACT_REFERENCES, payload: { name, value } }));
    },
    attachArtifact: (pathOrBuffer, name) => {
        if (!Buffer.isBuffer(pathOrBuffer) && !fs_1.default.existsSync(pathOrBuffer)) {
            (0, helpers_1.stdoutErrorEvent)('CurrentTest.attachArtifact', `pathOrBuffer must point to an existing file or contain Buffer. Buffer failed validation / file not found`);
            return;
        }
        if (name && !name.trim().length) {
            (0, helpers_1.stdoutErrorEvent)('CurrentTest.attachArtifact', `fileName must not be a blank string. Provided value is '${name}'`);
        }
        process.stdout.write(JSON.stringify({
            eventType: events_1.EVENT_NAMES.ATTACH_TEST_ARTIFACT,
            payload: { pathOrBuffer, timestamp: new Date().getTime(), name },
        }));
    },
    attachScreenshot: (pathOrBuffer) => {
        if (!Buffer.isBuffer(pathOrBuffer) && !fs_1.default.existsSync(pathOrBuffer)) {
            (0, helpers_1.stdoutErrorEvent)('CurrentTest.attachScreenshot', `pathOrBuffer must point to an existing file or contain Buffer. Buffer failed validation / file not found`);
            return;
        }
        process.stdout.write(JSON.stringify({
            eventType: events_1.EVENT_NAMES.ATTACH_TEST_SCREENSHOT,
            payload: { pathOrBuffer, timestamp: new Date().getTime() },
        }));
    },
    revertRegistration: () => {
        const eventType = events_1.EVENT_NAMES.REVERT_TEST_REGISTRATION;
        process.stdout.write(JSON.stringify({ eventType }));
    },
};
//# sourceMappingURL=CurrentTest.js.map