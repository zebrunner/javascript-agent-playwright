"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processAttachments = void 0;
const convertVideo_1 = require("./convertVideo");
const processAttachments = async (attachments) => {
    if (attachments) {
        const attachmentObj = {
            videos: [],
            files: [],
            screenshots: [],
        };
        for (const attachment of attachments) {
            if (attachment.contentType === 'video/webm') {
                await (0, convertVideo_1.convertVideo)(attachment.path, 'mp4');
                attachmentObj.videos.push({
                    path: attachment.path.replace('.webm', '.mp4'),
                    timestamp: Date.now(),
                });
            }
            if (attachment.contentType === 'application/zip') {
                attachmentObj.files.push({
                    path: attachment.path,
                    timestamp: Date.now(),
                });
            }
            if (attachment.contentType === 'image/png') {
                attachmentObj.screenshots.push({
                    path: attachment.path,
                    timestamp: Date.now(),
                });
            }
        }
        return attachmentObj;
    }
    return null;
};
exports.processAttachments = processAttachments;
//# sourceMappingURL=processAttachments.js.map