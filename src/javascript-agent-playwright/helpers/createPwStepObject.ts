export const createPwStepObject = (
  timestamp: number,
  title: string,
  action: string,
  screenshotPathOrBuffer?: string | Buffer,
) => {
  return {
    startTime: new Date(timestamp),
    title,
    duration: new Date().getTime() - timestamp,
    category: `zebrunner:${action}`,
    steps: [],
    titlePath: () => [`zebrunner:${action}`],
    screenshotPathOrBuffer,
  };
};
