import { Suite } from '@playwright/test/reporter';
import { ExtendedPwTestCase } from '../types';

export type TestIdentity = {
  name: string;
  className: string;
  methodName: string;
  projectName: string;
  suitePath: string;
};

export const buildTestIdentity = (pwTest: ExtendedPwTestCase): TestIdentity => {
  const projectName = pwTest._projectId || pwTest.parent.project()?.name || '';
  const suiteTitles: string[] = [];
  let suite: Suite | undefined = pwTest.parent;

  while (suite) {
    const suiteType = (suite as Suite & { type?: string }).type;
    if (suite.title && suiteType !== 'project') {
      suiteTitles.unshift(suite.title);
    }
    suite = suite.parent;
  }

  const suitePath = suiteTitles.join(' > ');
  const name = [projectName, suitePath, pwTest.title].filter(Boolean).join(' > ');

  return {
    name,
    className: suitePath,
    methodName: pwTest.title,
    projectName,
    suitePath,
  };
};
