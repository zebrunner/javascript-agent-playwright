"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.zephyr = exports.zebrunner = exports.xray = exports.testRail = exports.currentLaunch = exports.currentTest = void 0;
const ZebrunnerReporter_1 = __importDefault(require("./ZebrunnerReporter"));
var currentTest_1 = require("./currentTest");
Object.defineProperty(exports, "currentTest", { enumerable: true, get: function () { return currentTest_1.currentTest; } });
var currentLaunch_1 = require("./currentLaunch");
Object.defineProperty(exports, "currentLaunch", { enumerable: true, get: function () { return currentLaunch_1.currentLaunch; } });
var tcm_1 = require("./tcm");
Object.defineProperty(exports, "testRail", { enumerable: true, get: function () { return tcm_1.testRail; } });
Object.defineProperty(exports, "xray", { enumerable: true, get: function () { return tcm_1.xray; } });
Object.defineProperty(exports, "zebrunner", { enumerable: true, get: function () { return tcm_1.zebrunner; } });
Object.defineProperty(exports, "zephyr", { enumerable: true, get: function () { return tcm_1.zephyr; } });
exports.default = ZebrunnerReporter_1.default;
//# sourceMappingURL=index.js.map