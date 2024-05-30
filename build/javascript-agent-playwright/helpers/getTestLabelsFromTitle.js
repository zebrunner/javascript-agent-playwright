"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTestLabelsFromTitle = void 0;
const getTestLabelsFromTitle = (testTitle) => {
    const tags = testTitle.match(/@\w*/g) || [];
    if (tags.length !== 0) {
        return tags.map((c) => {
            if (typeof c === 'string') {
                return { key: 'tag', value: c.replace('@', '') };
            }
            if (typeof c === 'object') {
                return c;
            }
        });
    }
    return null;
};
exports.getTestLabelsFromTitle = getTestLabelsFromTitle;
//# sourceMappingURL=getTestLabelsFromTitle.js.map