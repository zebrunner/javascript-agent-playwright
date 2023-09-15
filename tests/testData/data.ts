import {testRun} from '../../src/lib/ResultsParser';
import ResultsParser from '../../src/lib/ResultsParser';
import { ReportingConfig } from '../../src/lib/reporting-config';

export type ParserFixture = {
  testData: any;
  parsedResults: testRun;
};

const config: ReportingConfig = {
  enabled: true,
  projectKey: 'DEF',
  server: {
    hostname: 'https://dkazaktest.zebrunner.org',
    accessToken: '7wkj2ZxyhN2s78e25cez6ZLWpId4Kza2ql1dYboObH0ugJDJo4'
  },
  launch: {
    displayName: "Playwright launch",
    build: '1.0.0',
    environment: 'Local'
  },
  milestone: {
    id: null,
    name: null
  },
  notifications: {
    notifyOnEachFailure: false,
    slackChannels: 'dev, qa',
    teamsChannels: 'dev-channel, management',
    emails: 'dkazak@zebrunner.com'
  },
  tcm: {
    testCaseStatus: {
      onPass: 'SUCCESS',
      onFail: 'FAILED',
    },
    zebrunner: {
      pushResults: false,
      pushInRealTime: false,
      testRunId: 42
    },
    testRail: {
      pushResults: false,
      pushInRealTime: false,
      suiteId: 100,
      runId: 500,
      includeAllTestCasesInNewRun: true,
      runName: 'New Demo Run',
      milestoneName: 'Demo Milestone',
      assignee: 'tester@mycompany.com'
    },
    xray: {
      pushResults: false,
      pushInRealTime: false,
      executionKey: 'QT-100'
    },
    zephyr: {
      pushResults: false,
      pushInRealTime: false,
      jiraProjectKey: 'ZEB',
      testCycleKey: 'ZEB-T1'
    }
  }
};

const projectObj = {
  define: [],
  expect: undefined,
  outputDir: '/Users/it/repo/pw-zeb/test-results',
  repeatEach: 1,
  retries: 0,
  metadata: undefined,
  name: 'webkit',
  testDir: '/Users/it/repo/pw-zeb',
  snapshotDir: '/Users/it/repo/pw-zeb',
  testIgnore: [],
  testMatch: '**/?(*.)@(spec|test).@(ts|js|mjs)',
  timeout: 0,
  use: {
    video: 'on',
    trace: 'on',
    screenshot: 'only-on-failure',
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.4 Safari/605.1.15',
    screen: {width: 1792, height: 1120},
    viewport: {width: 1280, height: 720},
    deviceScaleFactor: 2,
    isMobile: false,
    hasTouch: false,
    defaultBrowserType: 'webkit',
    headless: false,
  },
};

const testObj = {
  testData: {
    title: '',
    parent: undefined,
    suites: [
      {
        title: 'webkit',
        tests: [],
        suites: [
          {
            title: 'tests/pw_nested_testsuite.spec.js',
            tests: [],
            project: () => projectObj,
            suites: [
              {
                title: 'nested foo',
                tests: [],
                project: () => projectObj,
                suites: [
                  {
                    title: 'foo - L2',
                    suites: [],
                    project: () => projectObj,
                    parent: {
                      title: 'nested foo',
                    },
                    tests: [
                      {
                        title: 'basic test @broke',
                        retries: 0,
                        results: [
                          {
                            attachments: [
                              {
                                name: 'trace',
                                contentType: 'application/zip',
                                path: '/Users/it/repo/pw-zeb/test-results/tests-pw_nested_testsuite-nested-foo-foo-l2-basic-test-broke-webkit/trace.zip',
                              },
                              {
                                name: 'screenshot',
                                contentType: 'image/png',
                                path: '/Users/it/repo/pw-zeb/test-results/tests-pw_nested_testsuite-nested-foo-foo-l2-basic-test-broke-webkit/test-failed-1.png',
                              },
                            ],
                            error: {
                              message:
                                '\u001b[2mexpect(\u001b[22m\u001b[31mreceived\u001b[39m\u001b[2m).\u001b[22mtoHaveText\u001b[2m(\u001b[22m\u001b[32mexpected\u001b[39m\u001b[2m)\u001b[22m\n\nExpected string: \u001b[32m"Playwright\u001b[7m_broke\u001b[27m"\u001b[39m\nReceived string: \u001b[31m"Playwright"\u001b[39m\n\nCall log:\n  - \u001b[2mwaiting for selector ".navbar__inner .navbar__title"\u001b[22m\n\u001b[2m  -   selector resolved to <b class="navbar__title">Playwright</b>\u001b[22m\n\u001b[2m  -   unexpected value "Playwright"\u001b[22m\n\u001b[2m  -   selector resolved to <b class="navbar__title">Playwright</b>\u001b[22m\n\u001b[2m  -   unexpected value "Playwright"\u001b[22m\n\u001b[2m  -   selector resolved to <b class="navbar__title">Playwright</b>\u001b[22m\n\u001b[2m  -   unexpected value "Playwright"\u001b[22m\n\u001b[2m  -   selector resolved to <b class="navbar__title">Playwright</b>\u001b[22m\n\u001b[2m  -   unexpected value "Playwright"\u001b[22m\n\u001b[2m  -   selector resolved to <b class="navbar__title">Playwright</b>\u001b[22m\n\u001b[2m  -   unexpected value "Playwright"\u001b[22m\n\u001b[2m  -   selector resolved to <b class="navbar__title">Playwright</b>\u001b[22m\n\u001b[2m  -   unexpected value "Playwright"\u001b[22m\n\u001b[2m  -   selector resolved to <b class="navbar__title">Playwright</b>\u001b[22m\n\u001b[2m  -   unexpected value "Playwright"\u001b[22m\n\u001b[2m  -   selector resolved to <b class="navbar__title">Playwright</b>\u001b[22m\n\u001b[2m  -   unexpected value "Playwright"\u001b[22m\n',
                              stack:
                                'Error: \u001b[2mexpect(\u001b[22m\u001b[31mreceived\u001b[39m\u001b[2m).\u001b[22mtoHaveText\u001b[2m(\u001b[22m\u001b[32mexpected\u001b[39m\u001b[2m)\u001b[22m\n\nExpected string: \u001b[32m"Playwright\u001b[7m_broke\u001b[27m"\u001b[39m\nReceived string: \u001b[31m"Playwright"\u001b[39m\n\nCall log:\n  - \u001b[2mwaiting for selector ".navbar__inner .navbar__title"\u001b[22m\n\u001b[2m  -   selector resolved to <b class="navbar__title">Playwright</b>\u001b[22m\n\u001b[2m  -   unexpected value "Playwright"\u001b[22m\n\u001b[2m  -   selector resolved to <b class="navbar__title">Playwright</b>\u001b[22m\n\u001b[2m  -   unexpected value "Playwright"\u001b[22m\n\u001b[2m  -   selector resolved to <b class="navbar__title">Playwright</b>\u001b[22m\n\u001b[2m  -   unexpected value "Playwright"\u001b[22m\n\u001b[2m  -   selector resolved to <b class="navbar__title">Playwright</b>\u001b[22m\n\u001b[2m  -   unexpected value "Playwright"\u001b[22m\n\u001b[2m  -   selector resolved to <b class="navbar__title">Playwright</b>\u001b[22m\n\u001b[2m  -   unexpected value "Playwright"\u001b[22m\n\u001b[2m  -   selector resolved to <b class="navbar__title">Playwright</b>\u001b[22m\n\u001b[2m  -   unexpected value "Playwright"\u001b[22m\n\u001b[2m  -   selector resolved to <b class="navbar__title">Playwright</b>\u001b[22m\n\u001b[2m  -   unexpected value "Playwright"\u001b[22m\n\u001b[2m  -   selector resolved to <b class="navbar__title">Playwright</b>\u001b[22m\n\u001b[2m  -   unexpected value "Playwright"\u001b[22m\n\n    at /Users/it/repo/pw-zeb/tests/pw_nested_testsuite.spec.ts:24:27\n    at FixtureRunner.resolveParametersAndRunHookOrTest (/Users/it/repo/pw-zeb/node_modules/@playwright/test/lib/fixtures.js:306:12)\n    at WorkerRunner._runTestWithBeforeHooks (/Users/it/repo/pw-zeb/node_modules/@playwright/test/lib/workerRunner.js:499:7)',
                            },
                            startTime:
                              'Sat Dec 18 2021 19:43:16 GMT+1000 (Australian Eastern Standard Time)',
                            duration: 7630,
                            steps: [
                              {
                                title: 'Before Hooks',
                                startTime:
                                  'Sat Dec 18 2021 19:43:16 GMT+1000 (Australian Eastern Standard Time)',
                              },
                              {
                                title: 'expect.toHaveText',
                                startTime:
                                  'Sat Dec 18 2021 19:43:18 GMT+1000 (Australian Eastern Standard Time)',
                                error: {
                                  message:
                                    '\u001b[2mexpect(\u001b[22m\u001b[31mreceived\u001b[39m\u001b[2m).\u001b[22mtoHaveText\u001b[2m(\u001b[22m\u001b[32mexpected\u001b[39m\u001b[2m)\u001b[22m\n\nExpected string: \u001b[32m"Playwright\u001b[7m_broke\u001b[27m"\u001b[39m\nReceived string: \u001b[31m"Playwright"\u001b[39m\n\nCall log:\n  - \u001b[2mwaiting for selector ".navbar__inner .navbar__title"\u001b[22m\n\u001b[2m  -   selector resolved to <b class="navbar__title">Playwright</b>\u001b[22m\n\u001b[2m  -   unexpected value "Playwright"\u001b[22m\n\u001b[2m  -   selector resolved to <b class="navbar__title">Playwright</b>\u001b[22m\n\u001b[2m  -   unexpected value "Playwright"\u001b[22m\n\u001b[2m  -   selector resolved to <b class="navbar__title">Playwright</b>\u001b[22m\n\u001b[2m  -   unexpected value "Playwright"\u001b[22m\n\u001b[2m  -   selector resolved to <b class="navbar__title">Playwright</b>\u001b[22m\n\u001b[2m  -   unexpected value "Playwright"\u001b[22m\n\u001b[2m  -   selector resolved to <b class="navbar__title">Playwright</b>\u001b[22m\n\u001b[2m  -   unexpected value "Playwright"\u001b[22m\n\u001b[2m  -   selector resolved to <b class="navbar__title">Playwright</b>\u001b[22m\n\u001b[2m  -   unexpected value "Playwright"\u001b[22m\n\u001b[2m  -   selector resolved to <b class="navbar__title">Playwright</b>\u001b[22m\n\u001b[2m  -   unexpected value "Playwright"\u001b[22m\n\u001b[2m  -   selector resolved to <b class="navbar__title">Playwright</b>\u001b[22m\n\u001b[2m  -   unexpected value "Playwright"\u001b[22m\n',
                                  stack:
                                    '\u001b[2mexpect(\u001b[22m\u001b[31mreceived\u001b[39m\u001b[2m).\u001b[22mtoHaveText\u001b[2m(\u001b[22m\u001b[32mexpected\u001b[39m\u001b[2m)\u001b[22m\n\nExpected string: \u001b[32m"Playwright\u001b[7m_broke\u001b[27m"\u001b[39m\nReceived string: \u001b[31m"Playwright"\u001b[39m\n\nCall log:\n  - \u001b[2mwaiting for selector ".navbar__inner .navbar__title"\u001b[22m\n\u001b[2m  -   selector resolved to <b class="navbar__title">Playwright</b>\u001b[22m\n\u001b[2m  -   unexpected value "Playwright"\u001b[22m\n\u001b[2m  -   selector resolved to <b class="navbar__title">Playwright</b>\u001b[22m\n\u001b[2m  -   unexpected value "Playwright"\u001b[22m\n\u001b[2m  -   selector resolved to <b class="navbar__title">Playwright</b>\u001b[22m\n\u001b[2m  -   unexpected value "Playwright"\u001b[22m\n\u001b[2m  -   selector resolved to <b class="navbar__title">Playwright</b>\u001b[22m\n\u001b[2m  -   unexpected value "Playwright"\u001b[22m\n\u001b[2m  -   selector resolved to <b class="navbar__title">Playwright</b>\u001b[22m\n\u001b[2m  -   unexpected value "Playwright"\u001b[22m\n\u001b[2m  -   selector resolved to <b class="navbar__title">Playwright</b>\u001b[22m\n\u001b[2m  -   unexpected value "Playwright"\u001b[22m\n\u001b[2m  -   selector resolved to <b class="navbar__title">Playwright</b>\u001b[22m\n\u001b[2m  -   unexpected value "Playwright"\u001b[22m\n\u001b[2m  -   selector resolved to <b class="navbar__title">Playwright</b>\u001b[22m\n\u001b[2m  -   unexpected value "Playwright"\u001b[22m\n\n    at /Users/it/repo/pw-zeb/tests/pw_nested_testsuite.spec.ts:24:27\n    at FixtureRunner.resolveParametersAndRunHookOrTest (/Users/it/repo/pw-zeb/node_modules/@playwright/test/lib/fixtures.js:306:12)\n    at WorkerRunner._runTestWithBeforeHooks (/Users/it/repo/pw-zeb/node_modules/@playwright/test/lib/workerRunner.js:499:7)',
                                },
                              },
                            ],
                            retry: 0,
                            status: 'failed',
                          },
                        ],
                      },
                    ],
                  },
                ],
                parent: {
                  title: 'tests/pw_nested_testsuite.spec.js',
                },
              },
            ],
            parent: {
              title: 'webkit',
            },
          },
        ],
      },
    ],
    tests: [],
  },
  parsedResults: async ({testData}, use) => {
    let resultsParser = new ResultsParser(testData, config);
    resultsParser.parse();
    let r = await resultsParser.getParsedResults();
    await use(r);
  },
};

export {testObj};
