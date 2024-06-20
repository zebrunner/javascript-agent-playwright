import ffmpeg from 'fluent-ffmpeg';
import { path as ffmpegPath } from '@ffmpeg-installer/ffmpeg';
ffmpeg.setFfmpegPath(ffmpegPath);

export const convertVideo = async (path: string, format: string) => {
  try {
    return new Promise<void>((resolve, reject) => {
      const fileName = path.replace('.webm', '');
      const convertedFilePath = `${fileName}.${format}`;

      ffmpeg(path)
        .toFormat(format)
        .outputOptions(['-vsync 2'])
        .saveToFile(convertedFilePath)
        .on('end', () => {
          resolve();
        })
        .on('error', (error) => {
          return reject(new Error(error));
        });
    });
  } catch (error) {
    console.log('Error during convertVideo:', error);
  }
};
