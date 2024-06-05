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
          pathOrBuffer: attachment.path.replace('.webm', '.mp4'),
          timestamp: Date.now(),
        });
      }
      if (attachment.contentType === 'application/zip') {
        attachmentObj.files.push({
          pathOrBuffer: attachment.path,
          timestamp: Date.now(),
        });
      }
      if (attachment.contentType === 'image/png') {
        attachmentObj.screenshots.push({
          pathOrBuffer: attachment.path || attachment.body,
          timestamp: Date.now(),
          contentType: attachment.contentType,
        });
      }
    }

    return attachmentObj;
  }

  return null;
};
