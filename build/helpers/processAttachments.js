"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processAttachments = void 0;
const convertVideo_1 = require("./convertVideo");
const processAttachments = (attachment) => {
    if (attachment) {
        const attachmentObj = {
            videos: [],
            files: [],
            screenshots: [],
        };
        attachment.forEach(async (el) => {
            if (el.contentType === 'video/webm') {
                await (0, convertVideo_1.convertVideo)(el.path, 'mp4');
                attachmentObj.videos.push({
                    path: el.path.replace('.webm', '.mp4'),
                    timestamp: Date.now(),
                });
            }
            if (el.contentType === 'application/zip') {
                attachmentObj.files.push({
                    path: el.path,
                    timestamp: Date.now(),
                });
            }
            if (el.contentType === 'image/png') {
                attachmentObj.screenshots.push({
                    path: el.path,
                    timestamp: Date.now(),
                });
            }
        });
        return attachmentObj;
    }
    return null;
};
exports.processAttachments = processAttachments;
//# sourceMappingURL=processAttachments.js.map