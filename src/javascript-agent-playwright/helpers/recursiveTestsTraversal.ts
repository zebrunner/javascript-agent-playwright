import { Suite } from '@playwright/test/reporter';
import UAParser from 'ua-parser-js';
import { ExchangedLaunchContext } from '../ZebrunnerApiClient/types/ExchangedLaunchContext';
import { ExtendedPwTestCase } from '../types';
import { buildTestIdentity } from './buildTestIdentity';

export const recursiveTestsTraversal = (suite: Suite, exchangedLaunchContext: ExchangedLaunchContext) => {
  for (const res of suite.suites) {
    if (res.tests.length > 0) {
      const launchInfo = suite.project();
      const parser = new UAParser();
      parser.setUA(launchInfo.use.userAgent);
      const systemOptions = parser.getResult();
      res.tests = res.tests.filter((el) => {
        const testName = buildTestIdentity(el as ExtendedPwTestCase).name;
        const isSuitableTest = exchangedLaunchContext.testsToRun.some(
          (item: {
            id: number;
            name: string;
            correlationData: string;
            status: string;
            startedAt: string;
            endedAt: string;
          }) => {
            const { browser, version, os } = JSON.parse(item.correlationData);
            if (
              item.name === testName &&
              browser === systemOptions.browser.name &&
              version === systemOptions.browser.version &&
              os === systemOptions.os.name
            ) {
              return true;
            }
            return false;
          },
        );
        if (isSuitableTest) {
          return true;
        }
        return false;
      });
    }
    recursiveTestsTraversal(res, exchangedLaunchContext);
  }
};
