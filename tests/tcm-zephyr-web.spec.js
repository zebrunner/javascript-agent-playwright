// @ts-check
import { pseudoRandomBytes } from 'crypto';
import { currentTest, zephyr, currentLaunch } from '../src/javascript-agent-playwright/index';

const { test, expect } = require('@playwright/test');

const maintainer = 'testUser';
const automation_type = 'web';

const failed = 'FAIL';
const failed_case_key = 'ZEB-T4';

const passed = 'PASS';
const passed_case_key = 'ZEB-T5';

test.describe('Web Testing with Playwright', () => {
  test.beforeAll(async () => {
    // will be attached to the entire run
    currentLaunch.attachLabel('TCM', 'Zephyr');
    currentLaunch.attachLabel('automation-type', automation_type);
    currentLaunch.attachArtifactReference('Zebrunner', 'https://zebrunner.com');
  });

  test(`Test should be passed, but result for test case ${failed_case_key} should be imported as ${failed}`, async ({
    page,
  }) => {
    currentTest.setMaintainer(maintainer);
    currentTest.log.info('Custom log message example on test start');
    currentTest.attachArtifactReference('Zebrunner', 'https://zebrunner.com');

    zephyr.testCaseKey('ZEB-T2');
    zephyr.testCaseStatus(failed_case_key, failed);

    console.log('Maintainer should be ' + maintainer);

    await page.goto('https://playwright.dev/');
    currentTest.attachScreenshot(await page.screenshot());

    // Expect a title "to contain" a substring.
    await expect(page).toHaveTitle(/Playwright/);

    currentTest.log.info('Custom log message example on test finish');
  });

  test('Test should be passed (with console.log() and custom screenshot)', async ({ page }) => {
    currentTest.setMaintainer(maintainer);
    zephyr.testCaseKey('ZEB-T9', 'ZEB-T13');

    currentTest.log.info('INFO level log message on test start');
    currentTest.log.info('Navigating to Google...');

    await page.goto('https://www.google.com/');
    currentTest.attachScreenshot(await page.screenshot());

    await page.goto('https://playwright.dev/');
    currentTest.attachScreenshot(await page.screenshot());

    // Click the get started link.
    await page.getByRole('link', { name: 'Get started' }).click();

    // Expects page to have a heading with the name of Installation.
    await expect(page.getByRole('heading', { name: 'Installation' })).toBeVisible();

    currentTest.log.warn('Attaching screenshot via PATH on disk');
    currentTest.attachScreenshot('artifacts/zeb.png');

    console.log('Log should be 1');
    currentTest.log.info('INFO level log message 1');
    console.log('Log should be 2');
    currentTest.log.error('ERROR level log message 2');
    console.log('Log should be 3');
    currentTest.log.warn('WARN level log message 3');
    console.log('Log should be 4');
    currentTest.log.fatal('FATAL level log message 4');
    console.log('Log should be 5');
    currentTest.log.debug('DEBUG level log message 5');

    currentTest.log.warn('Attaching screenshot after log mesage 5');
    currentTest.attachScreenshot(await page.screenshot());

    currentTest.log.trace('TRACE level log message 6');
    currentTest.log.custom('CUSTOM string level log message 7', 'CUSTOM');

    console.log('Log should be 1.1');
    console.log('Log should be 1.2');
    console.log('Log should be 1.3');

    currentTest.log.info('Custom log message example on test finish (without log level, by default should be INFO 8)');
    currentTest.log.info('Attaching screenshot after all logs');
    currentTest.attachScreenshot(await page.screenshot());
  });

  test(`Test should be @failed but result for case ${passed_case_key} should be ${passed}`, async ({ page }) => {
    currentTest.setMaintainer(maintainer);
    currentTest.log.info('Custom log message example on test start');
    currentTest.attachLabel('reporting', 'Zebrunner');

    zephyr.testCaseKey('ZEB-T1');
    zephyr.testCaseStatus(passed_case_key, passed);

    await page.goto('https://playwright.dev/');
    currentTest.attachScreenshot(await page.screenshot());

    // Click the get started link.
    await expect(page.getByRole('link', { name: 'Get started - Oops!' })).toBeVisible();

    currentTest.log.info('Custom log message example on test finish');
  });

  test('Get started link incorrect - should be @aborted', async ({ page }, testInfo) => {
    currentTest.setMaintainer(maintainer);
    currentTest.attachLabel('type', 'smoke', 'regression');
    zephyr.testCaseKey('ZEB-T12');

    await page.goto('https://playwright.dev/');
    currentTest.attachScreenshot(await page.screenshot());

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

    currentTest.log.info('Custom log message example on test finish');
  });

  test('Not an important test (This test should not be reported in Zebrunner)', async ({ request }) => {
    currentTest.revertRegistration();
    zephyr.testCaseKey('ZEB-T10');
  });

  test('Skipped inside in test', async ({ page }, testInfo) => {
    zephyr.testCaseKey('ZEB-T10');

    await page.goto('https://example.com');
    currentTest.attachScreenshot(await page.screenshot());

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
