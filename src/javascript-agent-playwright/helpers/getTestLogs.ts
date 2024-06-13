import { TestLog } from '../types';
import { cleanseReason } from './cleanseReason';
import * as fs from 'fs';

export const getTestLogs = (steps, zbrTestId: number): TestLog[] => {
  const testSteps = [];

  for (const testStep of steps) {
    const lineFromSource =
      testStep.location?.file && testStep.location?.line
        ? fs.readFileSync(testStep.location.file, 'utf-8').split(/\r?\n/)[testStep.location?.line - 1].trim()
        : null;

    testSteps.push({
      timestamp: new Date(testStep.startTime).getTime(),
      message: testStep.error
        ? `${lineFromSource ? `${lineFromSource}\n\n` : ''}${cleanseReason(testStep.error?.message)} \n ${cleanseReason(
            testStep.error?.stack,
          )}`
        : lineFromSource
        ? lineFromSource
        : testStep.title,
      level: testStep.category.includes('zebrunner:log:')
        ? testStep.category.split(':')[2]
        : testStep.error
        ? 'ERROR'
        : 'INFO',
      testId: zbrTestId,
    });
  }

  return testSteps;
};
