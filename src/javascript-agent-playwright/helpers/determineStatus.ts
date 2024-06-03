export const determineStatus = (status) => {
  if (status === 'failed') return 'FAILED';
  if (status === 'passed') return 'PASSED';
  if (status === 'skipped') return 'SKIPPED';

  return 'ABORTED';
};
