"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseBrowserCapabilities = void 0;
const ua_parser_js_1 = __importDefault(require("ua-parser-js"));
const parseBrowserCapabilities = (launchInfo) => {
    const parser = new ua_parser_js_1.default();
    parser.setUA(launchInfo.use.userAgent);
    return parser.getResult();
};
exports.parseBrowserCapabilities = parseBrowserCapabilities;
//# sourceMappingURL=parseBrowserCapabilities.js.map