import { TestStep } from '../types';
import { cleanseReason } from './cleanseReason';

export const getTestSteps = (steps, zbrTestId: number): TestStep[] => {
  const testSteps = [];
  for (const testStep of steps) {
    testSteps.push({
      timestamp: new Date(testStep.startTime).getTime(),
      message: testStep.error
        ? `${cleanseReason(testStep.error?.message)} \n ${cleanseReason(testStep.error?.stack)}`
        : testStep.title,
      level: testStep.error ? 'ERROR' : 'INFO',
      testId: zbrTestId,
    });
  }

  return testSteps;
};
