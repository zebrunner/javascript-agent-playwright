"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFullSuiteName = void 0;
const getFullSuiteName = (pwTest) => {
    const suiteTitle = pwTest.parent.title;
    const suiteParentTitle = pwTest.parent.parent.title;
    return suiteParentTitle ? `${suiteParentTitle} > ${suiteTitle}` : suiteTitle;
};
exports.getFullSuiteName = getFullSuiteName;
//# sourceMappingURL=getFullSuiteName.js.map