import ffmpeg from 'fluent-ffmpeg';

export const convertVideo = async (path: string, format: string) => {
  try {
    const fileName = path.replace('.webm', '');
    const convertedFilePath = `${fileName}.${format}`;
    await ffmpeg(path).toFormat(format).outputOptions(['-vsync 2']).saveToFile(convertedFilePath);
  } catch (error) {
    console.log('Error during convertVideo:', error);
  }
};