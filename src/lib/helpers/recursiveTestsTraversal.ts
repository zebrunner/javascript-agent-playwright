import { Suite } from '@playwright/test/reporter';
import UAParser from 'ua-parser-js';
import { ExchangedRunContext } from '../ZebrunnerApiClient/types/ExchangedRunContext';

export const recursiveTestsTraversal = (suite: Suite, exchangedRunContext: ExchangedRunContext) => {
  // eslint-disable-next-line no-restricted-syntax
  for (const res of suite.suites) {
    if (res.tests.length > 0) {
      const suiteName = res.parent.title ? `${res.parent.title} > ${res.title}` : res.title;
      const launchInfo = suite.project();
      const parser = new UAParser();
      parser.setUA(launchInfo.use.userAgent);
      const systemOptions = parser.getResult();
      res.tests = res.tests.filter((el) => {
        const testName = `${suiteName} > ${el.title}`;
        const isSuitableTest = exchangedRunContext.testsToRun.some(
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
    recursiveTestsTraversal(res, exchangedRunContext);
  }
};
