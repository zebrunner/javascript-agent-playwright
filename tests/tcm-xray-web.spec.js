// @ts-check
import { pseudoRandomBytes } from 'crypto';
import { CurrentTest, xray, CurrentLaunch } from '../src/javascript-agent-playwright/index';

const { test, expect } = require('@playwright/test');

const maintainer = 'testUser';
const automation_type = 'web';

const failed = 'FAILED';
const failed_case_key = 'ZEB-51';

const passed = 'PASSED';
const passed_case_key = 'ZEB-24';

test.describe('Web Testing with Playwright', () => {
  test.beforeAll(async () => {
    // will be attached to the entire run
    CurrentLaunch.attachLabel('TCM', 'Xray');
    CurrentLaunch.attachLabel('automation-type', automation_type);
    CurrentLaunch.attachArtifactReference('Zebrunner', 'https://zebrunner.com');
  });

  test(`Test should be passed, but result for test case ${failed_case_key} should be imported as ${failed}`, async ({
    page,
  }) => {
    CurrentTest.setMaintainer(maintainer);
    CurrentTest.attachLog('Custom log message example on test start');
    CurrentTest.attachArtifactReference('Zebrunner', 'https://zebrunner.com');

    xray.testCaseKey('ZEB-18', failed_case_key);
    xray.testCaseStatus(failed_case_key, failed);

    console.log('Maintainer should be ' + maintainer);

    await page.goto('https://playwright.dev/');
    CurrentTest.attachScreenshot(await page.screenshot());

    // Expect a title "to contain" a substring.
    await expect(page).toHaveTitle(/Playwright/);

    CurrentTest.attachLog('Custom log message example on test finish');
  });

  test('Test should be passed (with console.log() and custom screenshot)', async ({ page }) => {
    CurrentTest.setMaintainer(maintainer);
    xray.testCaseKey('ZEB-17', 'ZEB-63');

    CurrentTest.attachLog('INFO level log message on test start', 'INFO');
    CurrentTest.attachLog('Navigating to Google...', 'INFO');

    await page.goto('https://www.google.com/');
    CurrentTest.attachScreenshot(await page.screenshot());

    await page.goto('https://playwright.dev/');
    CurrentTest.attachScreenshot(await page.screenshot());

    // Click the get started link.
    await page.getByRole('link', { name: 'Get started' }).click();

    // Expects page to have a heading with the name of Installation.
    await expect(page.getByRole('heading', { name: 'Installation' })).toBeVisible();

    CurrentTest.attachLog('Attaching screenshot via PATH on disk', 'WARN');
    CurrentTest.attachScreenshot('artifacts/zeb.png');

    console.log('Log should be 1');
    CurrentTest.attachLog('INFO level log message 1', 'INFO');
    console.log('Log should be 2');
    CurrentTest.attachLog('ERROR level log message 2', 'ERROR');
    console.log('Log should be 3');
    CurrentTest.attachLog('WARN level log message 3', 'WARN');
    console.log('Log should be 4');
    CurrentTest.attachLog('FATAL level log message 4', 'FATAL');
    console.log('Log should be 5');
    CurrentTest.attachLog('DEBUG level log message 5', 'DEBUG');

    CurrentTest.attachLog('Attaching screenshot after log mesage 5', 'WARN');
    CurrentTest.attachScreenshot(await page.screenshot());

    CurrentTest.attachLog('TRACE level log message 6', 'TRACE');
    CurrentTest.attachLog('CUSTOM string level log message 7', 'CUSTOM');

    console.log('Log should be 1.1');
    console.log('Log should be 1.2');
    console.log('Log should be 1.3');

    CurrentTest.attachLog('Custom log message example on test finish (without log level, by default should be INFO 8)');
    CurrentTest.attachLog('Attaching screenshot after all logs', 'INFO');
    CurrentTest.attachScreenshot(await page.screenshot());
  });

  test(`Test should be @failed but result for case ${passed_case_key} should be ${passed}`, async ({ page }) => {
    CurrentTest.setMaintainer(maintainer);
    CurrentTest.attachLog('Custom log message example on test start');
    CurrentTest.attachLabel('reporting', 'Zebrunner');

    xray.testCaseKey('ZEB-65');
    xray.testCaseStatus(passed_case_key, passed);

    await page.goto('https://playwright.dev/');
    CurrentTest.attachScreenshot(await page.screenshot());

    // Click the get started link.
    await expect(page.getByRole('link', { name: 'Get started - Oops!' })).toBeVisible();

    CurrentTest.attachLog('Custom log message example on test finish');
  });

  test('Get started link incorrect - should be @aborted', async ({ page }, testInfo) => {
    CurrentTest.setMaintainer(maintainer);
    CurrentTest.attachLabel('type', 'smoke', 'regression');
    xray.testCaseKey('ZEB-19');

    await page.goto('https://playwright.dev/');
    CurrentTest.attachScreenshot(await page.screenshot());

    // Click the get started link.
    await page.getByRole('link', { name: 'Get started - Oops!' }).click();

    // Expects page to have a heading with the name of Installation.
    await expect(page.getByRole('heading', { name: 'Installation' })).toBeVisible();
  });

  test.skip('Get started link - should be @skipped', async ({ page }) => {
    await page.goto('https://playwright.dev/');

    // Click the get started link.
    await page.getByRole('link', { name: 'Get started' }).click();

    // Expects page to have a heading with the name of Installation.
    await expect(page.getByRole('heading', { name: 'Installation' })).toBeVisible();

    CurrentTest.attachLog('Custom log message example on test finish');
  });

  test('Not an important test (This test should not be reported in Zebrunner)', async ({ request }) => {
    CurrentTest.revertRegistration();
    xray.testCaseKey('ZEB-20');
  });
  test('Skipped inside in test', async ({ page }, testInfo) => {
    xray.testCaseKey('ZEB-20');

    await page.goto('https://example.com');
    CurrentTest.attachScreenshot(await page.screenshot());

    const conditionToSkip = true;

    if (conditionToSkip) {
      testInfo.annotations.push({
        type: 'skip',
        description: 'Test skipped due to condition',
      });
      test.skip();
    }

    await page.goto('https://example.com');
    const title = await page.title();
    expect(title).toBe('Example Domain');
  });
});
