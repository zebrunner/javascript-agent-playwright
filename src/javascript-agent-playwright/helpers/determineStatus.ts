export const determineStatus = (status) => {
  if (status === 'failed') return 'FAILED';
  if (status === 'passed') return 'PASSED';
  if (status === 'skipped') return 'SKIPPED';

  return 'ABORTED';
};

export const determineLogLevel = (status) => {
  if (status === 'failed' || status === 'timedOut' || status === 'interrupted') return 'ERROR';
  return 'INFO';
};
