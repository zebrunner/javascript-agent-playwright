"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.recursiveTestsTraversal = void 0;
const ua_parser_js_1 = __importDefault(require("ua-parser-js"));
const recursiveTestsTraversal = (suite, exchangedRunContext) => {
    // eslint-disable-next-line no-restricted-syntax
    for (const res of suite.suites) {
        if (res.tests.length > 0) {
            const suiteName = res.parent.title ? `${res.parent.title} > ${res.title}` : res.title;
            const launchInfo = suite.project();
            const parser = new ua_parser_js_1.default();
            parser.setUA(launchInfo.use.userAgent);
            const systemOptions = parser.getResult();
            res.tests = res.tests.filter((el) => {
                const testName = `${suiteName} > ${el.title}`;
                const isSuitableTest = exchangedRunContext.testsToRun.some((item) => {
                    const { browser, version, os } = JSON.parse(item.correlationData);
                    if (item.name === testName &&
                        browser === systemOptions.browser.name &&
                        version === systemOptions.browser.version &&
                        os === systemOptions.os.name) {
                        return true;
                    }
                    return false;
                });
                if (isSuitableTest) {
                    return true;
                }
                return false;
            });
        }
        (0, exports.recursiveTestsTraversal)(res, exchangedRunContext);
    }
};
exports.recursiveTestsTraversal = recursiveTestsTraversal;
//# sourceMappingURL=recursiveTestsTraversal.js.map