import {test, expect} from '@playwright/test';
import ResultsParser from '../src/lib/ResultsParser';
import ZebRunnerReporter from '../src/lib/zebReporter';

const portNumber = 8181;
const projectKey = 'TEST';
const baseUrl = 'http://localhost';

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
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.4 Safari/605.1.15',
    screen: { width: 1792, height: 1120 },
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 2,
    isMobile: false,
    hasTouch: false,
    defaultBrowserType: 'webkit',
    headless: false
  }
};

// TODO: move to constants
const testData = {
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
                  parent: {
                    title: 'nested foo',
                  },
                  project: () => projectObj,
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
};

// server is started via node ./woka.js
test.describe('zebrunner upload', async () => {
  test('send results to fake Zebrunner @unit_test', async () => {
    const zeb = new ZebRunnerReporter();
    // TODO: Move to constants
    zeb.onBegin(
      {
        forbidOnly: false,
        globalSetup: null,
        globalTeardown: null,
        globalTimeout: 0,
        grep: /.*/,
        grepInvert: null,
        maxFailures: 0,
        preserveOutput: 'always',
        quiet: false,
        reportSlowTests: {max: 5, threshold: 1500},
        rootDir: '',
        shard: null,
        updateSnapshots: 'missing',
        version: '1.17.1',
        webServer: null,
        workers: 8,
        projects: [
          {
            expect: undefined,
            metadata: undefined,
            name: 'webkit',
            outputDir: '',
            repeatEach: 1,
            retries: 0,
            snapshotDir: '',
            testDir: '',
            testIgnore: [],
            testMatch: '**/?(*.)@(spec|test).@(ts|js|mjs)',
            timeout: 0,
            use: {},
          },
        ],
        reporter: [
          [
            '/Users/it/repo/pw-zeb/src/build/src/lib/zebReporter.ts',
            {
              reportingServerHostname: `${baseUrl}:${portNumber}`,
              reportingProjectKey: projectKey,
              enabled: true,
              pwConcurrentTasks: 10,
            },
          ],
        ],
      },
      undefined
    );

    let resultsParser = new ResultsParser(testData, null, null);
    await resultsParser.parse();
    let parsedResults = await resultsParser.getParsedResults();
    let result = await zeb.postResultsToZebRunner(1000, parsedResults);
    delete result.testsExecutions.results;
    expect(result).toEqual({
      testsExecutions: {
        success: 1,
        errors: 0,
      },
      videoArtifacts: {
        errors: 0,
        success: 0,
      },
      testArtifacts: {
        errors: 0,
        success: 0,
      },
      testRunTags: {
        success: 1,
        errors: 0,
      },
      testTags: {
        success: 1,
        errors: 0,
      },
      screenshots: {
        success: 0,
        errors: 1,
      },
      testStepsRequests: {
        success: 1,
        errors: 0,
      },
      endTestExecutions: {
        success: 1,
        errors: 0,
      },
      testSessions: {
        success: 0,
        errors: 0,
      },
      stopTestRunsResult: {
        success: 1,
        errors: 0,
      },
      resultsLink: 'http://localhost:8181/projects/TEST/test-runs/1000',
    });
  });
});
