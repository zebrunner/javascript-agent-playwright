"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.zephyr = exports.zebrunner = exports.xray = exports.testRail = exports.CurrentLaunch = exports.CurrentTest = void 0;
const ZebrunnerReporter_1 = __importDefault(require("./ZebrunnerReporter"));
var CurrentTest_1 = require("./CurrentTest");
Object.defineProperty(exports, "CurrentTest", { enumerable: true, get: function () { return CurrentTest_1.CurrentTest; } });
var CurrentLaunch_1 = require("./CurrentLaunch");
Object.defineProperty(exports, "CurrentLaunch", { enumerable: true, get: function () { return CurrentLaunch_1.CurrentLaunch; } });
var tcm_1 = require("./tcm");
Object.defineProperty(exports, "testRail", { enumerable: true, get: function () { return tcm_1.testRail; } });
Object.defineProperty(exports, "xray", { enumerable: true, get: function () { return tcm_1.xray; } });
Object.defineProperty(exports, "zebrunner", { enumerable: true, get: function () { return tcm_1.zebrunner; } });
Object.defineProperty(exports, "zephyr", { enumerable: true, get: function () { return tcm_1.zephyr; } });
exports.default = ZebrunnerReporter_1.default;
//# sourceMappingURL=index.js.map