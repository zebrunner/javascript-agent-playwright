import * as path from 'path';
import { FileArtifact } from '../types';

const artifactKey = (artifact: FileArtifact): string => {
  if (artifact.fingerprint) return `fingerprint:${artifact.fingerprint}:${artifact.name || ''}`;
  if (typeof artifact.pathOrBuffer === 'string') {
    return `path:${artifact.pathOrBuffer}:${artifact.name || ''}`;
  }
  return `buffer:${artifact.name || ''}:${artifact.pathOrBuffer.length}:${artifact.timestamp}`;
};

export const prepareAttemptArtifacts = (
  artifacts: FileArtifact[],
  attempt: number,
  prefixNames: boolean,
): FileArtifact[] => {
  const unique = new Map<string, FileArtifact>();

  for (const artifact of artifacts) {
    const effectiveName =
      artifact.name ||
      (typeof artifact.pathOrBuffer === 'string'
        ? path.basename(artifact.pathOrBuffer)
        : `artifact-${artifact.timestamp}`);
    const prepared = prefixNames
      ? { ...artifact, name: `attempt-${attempt + 1}-${effectiveName}` }
      : artifact;
    unique.set(artifactKey(prepared), prepared);
  }

  return [...unique.values()];
};
