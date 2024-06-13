export const createPwStepObject = (timestamp: number, title: string, level = 'INFO') => {
  return {
    startTime: new Date(timestamp),
    title,
    duration: new Date().getTime() - timestamp,
    category: `zebrunner:log:${level}`,
    steps: [],
    titlePath: () => [`zebrunner:log:${level}`],
  };
};
