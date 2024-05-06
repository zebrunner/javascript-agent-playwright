import * as fs from 'fs';

export const getFileSizeInBytes = (filename: string) => {
  const stats = fs.statSync(filename);

  return stats.size;
};
