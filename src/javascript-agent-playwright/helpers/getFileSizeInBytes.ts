import * as fs from 'fs';

export const getFileSizeInBytes = (pathOrBuffer: string | Buffer) => {
  let size: number;

  if (Buffer.isBuffer(pathOrBuffer)) {
    size = Buffer.byteLength(pathOrBuffer);
  } else {
    const stats = fs.statSync(pathOrBuffer);
    size = stats.size;
  }

  return size;
};
