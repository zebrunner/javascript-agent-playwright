export const cleanseReason = (rawReason) => {
  return rawReason
    ? rawReason
        .replace(/\u001b\[2m/g, '')
        .replace(/\u001b\[22m/g, '')
        .replace(/\u001b\[31m/g, '')
        .replace(/\u001b\[39m/g, '')
        .replace(/\u001b\[32m/g, '')
        .replace(/\u001b\[27m/g, '')
        .replace(/\u001b\[7m/g, '')
    : '';
};
