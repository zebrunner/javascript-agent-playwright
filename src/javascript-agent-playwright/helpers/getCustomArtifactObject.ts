export const getCustomArtifactObject = (payload) => {
  return {
    timestamp: payload.timestamp,
    pathOrBuffer: payload.pathOrBuffer.type === 'Buffer' ? Buffer.from(payload.pathOrBuffer) : payload.pathOrBuffer,
    name: payload.name,
  };
};
