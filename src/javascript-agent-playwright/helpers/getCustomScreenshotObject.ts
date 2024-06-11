export const getCustomScreenshotObject = (payload) => {
  return {
    timestamp: payload.timestamp,
    pathOrBuffer: payload.pathOrBuffer.type === 'Buffer' ? Buffer.from(payload.pathOrBuffer) : payload.pathOrBuffer,
  };
};
