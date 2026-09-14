export const createPwStepObject = (
  timestamp: number,
  title: string,
  action: string,
  screenshotPathOrBuffer?: string | Buffer,
  deleteAfterUpload?: boolean,
) => {
  return {
    startTime: new Date(timestamp),
    title,
    duration: new Date().getTime() - timestamp,
    category: `zebrunner:${action}`,
    steps: [],
    annotations: [],
    attachments: [],
    titlePath: () => [`zebrunner:${action}`],
    screenshotPathOrBuffer,
    deleteAfterUpload,
  };
};
