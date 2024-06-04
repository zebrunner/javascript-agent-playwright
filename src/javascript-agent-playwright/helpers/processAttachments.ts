import { convertVideo } from './convertVideo';

export const processAttachments = async (attachments) => {
  if (attachments) {
    const attachmentObj = {
      videos: [],
      files: [],
      screenshots: [],
    };

    for (const attachment of attachments) {
      if (attachment.contentType === 'video/webm') {
        await convertVideo(attachment.path, 'mp4');
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
          contentType: attachment.contentType,
          body: attachment.body,
          timestamp: Date.now(),
        });
      }
    }

    return attachmentObj;
  }

  return null;
};
