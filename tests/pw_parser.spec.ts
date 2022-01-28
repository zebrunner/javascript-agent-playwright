import {test as base, expect} from '@playwright/test';
import { ParserFixture, testObj } from './testData/data';

const test = base.extend<ParserFixture>(testObj);

test('parses test tags from the results @unit_test', async ({parsedResults}) => {
  expect(parsedResults.tests[0].tags).toEqual([{key: 'tag', value: 'broke'}]);
});

test('parses test steps from the results @unit_test', async ({parsedResults}) => {
  expect(parsedResults.tests[0].steps).toEqual([
    {timestamp: 1639820596000, message: 'Before Hooks', level: 'INFO'},
    {
      timestamp: 1639820598000,
      message:
        'expect(received).toHaveText(expected)\n\nExpected string: "Playwright_broke"\nReceived string: "Playwright"\n\nCall log:\n  - waiting for selector ".navbar__inner .navbar__title"\n  -   selector resolved to <b class="navbar__title">Playwright</b>\n  -   unexpected value "Playwright"\n  -   selector resolved to <b class="navbar__title">Playwright</b>\n  -   unexpected value "Playwright"\n  -   selector resolved to <b class="navbar__title">Playwright</b>\n  -   unexpected value "Playwright"\n  -   selector resolved to <b class="navbar__title">Playwright</b>\n  -   unexpected value "Playwright"\n  -   selector resolved to <b class="navbar__title">Playwright</b>\n  -   unexpected value "Playwright"\n  -   selector resolved to <b class="navbar__title">Playwright</b>\n  -   unexpected value "Playwright"\n  -   selector resolved to <b class="navbar__title">Playwright</b>\n  -   unexpected value "Playwright"\n  -   selector resolved to <b class="navbar__title">Playwright</b>\n  -   unexpected value "Playwright"\n \n expect(received).toHaveText(expected)\n\nExpected string: "Playwright_broke"\nReceived string: "Playwright"\n\nCall log:\n  - waiting for selector ".navbar__inner .navbar__title"\n  -   selector resolved to <b class="navbar__title">Playwright</b>\n  -   unexpected value "Playwright"\n  -   selector resolved to <b class="navbar__title">Playwright</b>\n  -   unexpected value "Playwright"\n  -   selector resolved to <b class="navbar__title">Playwright</b>\n  -   unexpected value "Playwright"\n  -   selector resolved to <b class="navbar__title">Playwright</b>\n  -   unexpected value "Playwright"\n  -   selector resolved to <b class="navbar__title">Playwright</b>\n  -   unexpected value "Playwright"\n  -   selector resolved to <b class="navbar__title">Playwright</b>\n  -   unexpected value "Playwright"\n  -   selector resolved to <b class="navbar__title">Playwright</b>\n  -   unexpected value "Playwright"\n  -   selector resolved to <b class="navbar__title">Playwright</b>\n  -   unexpected value "Playwright"\n\n    at /Users/it/repo/pw-zeb/tests/pw_nested_testsuite.spec.ts:24:27\n    at FixtureRunner.resolveParametersAndRunHookOrTest (/Users/it/repo/pw-zeb/node_modules/@playwright/test/lib/fixtures.js:306:12)\n    at WorkerRunner._runTestWithBeforeHooks (/Users/it/repo/pw-zeb/node_modules/@playwright/test/lib/workerRunner.js:499:7)',
      level: 'ERROR',
    },
  ]);
});

test('parses test failure details from the results @unit_test', async ({parsedResults}) => {
  expect(parsedResults.tests[0].reason).toEqual(
    'expect(received).toHaveText(expected)\n\nExpected string: "Playwright_broke"\nReceived string: "Playwright"\n\nCall log:\n  - waiting for selector ".navbar__inner .navbar__title"\n  -   selector resolved to <b class="navbar__title">Playwright</b>\n  -   unexpected value "Playwright"\n  -   selector resolved to <b class="navbar__title">Playwright</b>\n  -   unexpected value "Playwright"\n  -   selector resolved to <b class="navbar__title">Playwright</b>\n  -   unexpected value "Playwright"\n  -   selector resolved to <b class="navbar__title">Playwright</b>\n  -   unexpected value "Playwright"\n  -   selector resolved to <b class="navbar__title">Playwright</b>\n  -   unexpected value "Playwright"\n  -   selector resolved to <b class="navbar__title">Playwright</b>\n  -   unexpected value "Playwright"\n  -   selector resolved to <b class="navbar__title">Playwright</b>\n  -   unexpected value "Playwright"\n  -   selector resolved to <b class="navbar__title">Playwright</b>\n  -   unexpected value "Playwright"\n \n Error: expect(received).toHaveText(expected)\n\nExpected string: "Playwright_broke"\nReceived string: "Playwright"\n\nCall log:\n  - waiting for selector ".navbar__inner .navbar__title"\n  -   selector resolved to <b class="navbar__title">Playwright</b>\n  -   unexpected value "Playwright"\n  -   selector resolved to <b class="navbar__title">Playwright</b>\n  -   unexpected value "Playwright"\n  -   selector resolved to <b class="navbar__title">Playwright</b>\n  -   unexpected value "Playwright"\n  -   selector resolved to <b class="navbar__title">Playwright</b>\n  -   unexpected value "Playwright"\n  -   selector resolved to <b class="navbar__title">Playwright</b>\n  -   unexpected value "Playwright"\n  -   selector resolved to <b class="navbar__title">Playwright</b>\n  -   unexpected value "Playwright"\n  -   selector resolved to <b class="navbar__title">Playwright</b>\n  -   unexpected value "Playwright"\n  -   selector resolved to <b class="navbar__title">Playwright</b>\n  -   unexpected value "Playwright"\n\n    at /Users/it/repo/pw-zeb/tests/pw_nested_testsuite.spec.ts:24:27\n    at FixtureRunner.resolveParametersAndRunHookOrTest (/Users/it/repo/pw-zeb/node_modules/@playwright/test/lib/fixtures.js:306:12)\n    at WorkerRunner._runTestWithBeforeHooks (/Users/it/repo/pw-zeb/node_modules/@playwright/test/lib/workerRunner.js:499:7)'
  );
  expect(parsedResults.tests[0].status).toEqual('FAILED');
  expect(parsedResults.tests[0].retry).toEqual(0);
});

test('parses path to the screenshot from the results @unit_test', async ({parsedResults}) => {
  expect(parsedResults.tests[0].attachment.screenshots[0].path).toEqual(
    '/Users/it/repo/pw-zeb/test-results/tests-pw_nested_testsuite-nested-foo-foo-l2-basic-test-broke-webkit/test-failed-1.png'
  );
});

test('parses test details from the results @unit_test', async ({parsedResults}) => {
  expect(parsedResults.tests.length).toEqual(1);
  expect(parsedResults.tests[0].startedAt).toEqual(new Date('2021-12-18T09:43:16.000Z'));
  expect(parsedResults.tests[0].endedAt).toEqual(new Date('2021-12-18T09:43:23.630Z'));
  expect(parsedResults.tests[0].name).toEqual('nested foo > foo - L2 > basic test @broke');
  expect(parsedResults.tests[0].suiteName).toEqual('nested foo > foo - L2');
  expect(parsedResults.tests[0].browserCapabilities).toStrictEqual({
    ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.4 Safari/605.1.15',
    browser: {name: 'Safari', version: '15.4', major: '15'},
    engine: {name: 'WebKit', version: '605.1.15'},
    os: {name: 'Mac OS', version: '10.15.7'},
    device: {vendor: undefined, model: undefined, type: undefined},
    cpu: {architecture: undefined},
  });
});
