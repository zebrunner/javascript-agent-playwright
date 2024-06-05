"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stdoutErrorEvent = void 0;
const events_1 = require("../constants/events");
const stdoutErrorEvent = (stage, message) => {
    process.stdout.write(JSON.stringify({
        eventType: events_1.EVENT_NAMES.LOG_ERROR,
        payload: {
            stage: stage,
            message: message,
        },
    }));
};
exports.stdoutErrorEvent = stdoutErrorEvent;
//# sourceMappingURL=stdoutErrorEvent.js.map