"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getErrorsStringFromMap = void 0;
const getErrorsStringFromMap = (errors) => {
    let errorsString = '';
    errors.forEach((value, key) => (errorsString += `${key} (x${value})`));
    return errorsString.replace(/[)](?=.*[)])/g, '), ');
};
exports.getErrorsStringFromMap = getErrorsStringFromMap;
//# sourceMappingURL=getErrorsStringFromMap.js.map