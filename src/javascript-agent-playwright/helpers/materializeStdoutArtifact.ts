import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createHash, randomUUID } from 'crypto';

const hashFileSha256 = (filePath: string): string => {
  const hash = createHash('sha256');
  const fd = fs.openSync(filePath, 'r');
  try {
    const chunk = Buffer.alloc(64 * 1024);
    let bytesRead = 0;
    while ((bytesRead = fs.readSync(fd, chunk, 0, chunk.length, null)) > 0) {
      hash.update(chunk.subarray(0, bytesRead));
    }
  } finally {
    fs.closeSync(fd);
  }
  return hash.digest('hex');
};

export const materializeStdoutArtifact = (pathOrBuffer: string | Buffer, name?: string, defaultExtension = '.bin') => {
  if (!Buffer.isBuffer(pathOrBuffer)) {
    return { pathOrBuffer, deleteAfterUpload: false };
  }

  const extension = (name && path.extname(name)) || defaultExtension;
  const filePath = path.join(os.tmpdir(), `zbr-stdout-artifact-${randomUUID()}${extension}`);
  fs.writeFileSync(filePath, pathOrBuffer);

  return {
    pathOrBuffer: filePath,
    deleteAfterUpload: true,
    fingerprint: hashFileSha256(filePath),
  };
};
