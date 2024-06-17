"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CurrentLaunch = void 0;
const events_1 = require("./constants/events");
const helpers_1 = require("./helpers");
const type_utils_1 = require("./helpers/type-utils");
const fs_1 = __importDefault(require("fs"));
exports.CurrentLaunch = {
    attachLabel: (key, ...values) => {
        if (!(0, type_utils_1.isNotBlankString)(key)) {
            (0, helpers_1.stdoutErrorEvent)('CurrentLaunch.attachLabel', `Label key must be a not blank string. Provided value is '${key}'`);
            return;
        }
        if (!(0, type_utils_1.isNotEmptyArray)(values)) {
            (0, helpers_1.stdoutErrorEvent)('CurrentLaunch.attachLabel', `You must provide at least one label value. The label with the key '${key}' has none`);
            return;
        }
        values = values.filter((value) => {
            const isNotBlank = (0, type_utils_1.isNotBlankString)(value);
            if (!isNotBlank) {
                (0, helpers_1.stdoutErrorEvent)('CurrentLaunch.attachLabel', `Label value must be a not blank string. Provided value for key '${key}' is '${value}'`);
            }
            return isNotBlank;
        });
        if ((0, type_utils_1.isNotEmptyArray)(values)) {
            process.stdout.write(JSON.stringify({ eventType: events_1.EVENT_NAMES.ATTACH_LAUNCH_LABELS, payload: { key, values } }));
        }
    },
    attachArtifactReference: (name, value) => {
        if (!(0, type_utils_1.isNotBlankString)(name)) {
            (0, helpers_1.stdoutErrorEvent)('CurrentLaunch.attachArtifactReference', `Artifact reference name must be a not blank string. Provided value is '${name}'`);
            return;
        }
        if (!(0, type_utils_1.isNotBlankString)(value)) {
            (0, helpers_1.stdoutErrorEvent)('CurrentLaunch.attachArtifactReference', `Artifact reference value must be a not blank string. Provided value for name '${value}' is '${value}'`);
            return;
        }
        process.stdout.write(JSON.stringify({ eventType: events_1.EVENT_NAMES.ATTACH_LAUNCH_ARTIFACT_REFERENCES, payload: { name, value } }));
    },
    attachArtifact: (pathOrBuffer, name) => {
        const timestamp = new Date().getTime();
        if (!Buffer.isBuffer(pathOrBuffer) && !fs_1.default.existsSync(pathOrBuffer)) {
            (0, helpers_1.stdoutErrorEvent)('CurrentLaunch.attachArtifact', `pathOrBuffer must point to an existing file or contain Buffer. Buffer failed validation, file not found`);
            return;
        }
        if (name && !name.trim().length) {
            (0, helpers_1.stdoutErrorEvent)('CurrentTest.attachArtifact', `fileName must not be a blank string. Provided value is '${name}'`);
        }
        process.stdout.write(JSON.stringify({
            eventType: events_1.EVENT_NAMES.ATTACH_LAUNCH_ARTIFACT,
            payload: { pathOrBuffer, timestamp, name },
        }));
    },
};
//# sourceMappingURL=CurrentLaunch.js.map