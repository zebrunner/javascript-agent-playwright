import { expect, test } from '@playwright/test';
import { currentTest, zebrunner, currentLaunch } from '../src/javascript-agent-playwright/index';
const { chromium } = require('playwright');
import * as fs from 'fs';

test.describe('nested foo', () => {
  test.beforeAll(async () => {
    currentLaunch.attachLabel('test_run_label_key', 'run_label_value_one', 'run_label_value_two');
    currentLaunch.attachArtifactReference('someRunArtifactName', 'https://zebrunner.com');
    currentLaunch.attachArtifact('C:\\Users\\Mr_Fi\\Desktop\\Zebrunner\\TEST_ARTIFACT.txt');
    const bufferFileOne = fs.readFileSync('C:\\Users\\Mr_Fi\\Desktop\\Zebrunner\\TEST_ARTIFACT2.txt');
    currentLaunch.attachArtifact(bufferFileOne);
  });

  test('Get started link (with console.log() and custom screenshots and logs)', async ({ page }, testInfo) => {
    currentTest.setMaintainer('edovnar');

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
    //await expect(page.getByRole('heading', { name: '1231231313' })).toBeVisible();

    currentTest.log.warn('BEFORE Attaching screenshot via PATH on disk');
    currentTest.attachScreenshot(await page.screenshot());

    console.log('Log should be 1');
    console.log('Log should be 2');
    console.log('Log should be 3');
    console.log('Log should be 4');
    console.log('Log should be 5');

    currentTest.attachArtifact('C:\\Users\\Mr_Fi\\Desktop\\Zebrunner\\TEST_ARTIFACT.txt');
    currentTest.attachArtifactReference('referenceT.txt', 'https://google.com');

    currentTest.log.info('INFO level log message 1');
    currentTest.log.error('ERROR level log message 2');
    currentTest.log.warn('WARN level log message 3');
    currentTest.log.fatal('FATAL level log message 4');
    currentTest.log.debug('DEBUG level log message 5');
    currentTest.log.trace('TRACE level log message 6');

    currentTest.log.custom('CUSTOM string level log message 7', 'CUSTOM');

    currentTest.log.info('Custom log message example on test finish (without log level, by default should be INFO 8)');
  });

  test('Skipped inside in test', async ({ page }, testInfo) => {
    currentLaunch.attachArtifactReference('Zebrunner', 'https://zebrunner.com');
    currentTest.attachArtifact('C:\\Users\\Mr_Fi\\Desktop\\Zebrunner\\TEST_ARTIFACT.txt');
    currentTest.attachLabel('type', 'smoke');
    currentTest.setMaintainer('edovnar');

    await page.goto('https://example.com');
    currentTest.log.warn('This test should be skipped!)');
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

  test('test running in Chrome @ff @smoke_test @slow', async ({ page }, testInfo) => {
    currentTest.setMaintainer('edovnar');
    const browser = await chromium.launch();
    const page1 = await browser.newPage('https://github.com');

    console.log('Custom Message from console.log');
    currentTest.log.info('NO PARAMETER custom log message');

    currentTest.log.info('INFO level log message');
    currentTest.log.debug('DEBUG level log message');
    currentTest.log.error('ERROR level log message');
    currentTest.log.warn('WARN level log message');
    currentTest.log.trace('TRACE level log message');
    currentTest.log.fatal('FATAL level log message');

    currentTest.log.custom('CUSTOM string level log message', 'CUSTOM');

    zebrunner.testCaseKey('DEF-1231');
    zebrunner.testCaseStatus('DEF-1249', 'Retest');
    currentTest.attachLabel('someTestLabelKey', 'someTestLabelValueOne', 'someTestLabelValueTwo');
    currentTest.attachArtifact('C:\\Users\\Mr_Fi\\Desktop\\Zebrunner\\TEST_ARTIFACT.txt');
    currentTest.attachArtifactReference('someTestArtifactName', 'https://zebrunner.com');
    await page1.goto('https://zebrunner.com');

    const bufferScreenshot1 = await page1.screenshot();
    currentTest.attachArtifact(bufferScreenshot1);
    const bufferScreenshot2 = await page1.screenshot();
    currentTest.attachArtifact(bufferScreenshot2, 'screenshot2.png');

    currentTest.attachScreenshot(await page1.screenshot());

    await browser.close();
  });

  test.describe('foo - l2 ', () => {
    test.beforeEach(async ({ page }) => {
      // Go to the starting url before each test.
      await page.goto('https://playwright.dev/');
    });

    test.skip('skipped test', async ({ page }) => {
      // Assertions use the expect API.
      await expect(page).toHaveURL('https://playwright.dev/');
    });

    test('basic test with revert @broke', async ({ page }, testInfo) => {
      // testInfo.annotations.push({type: 'maintainer', description: 'emarf'});
      currentTest.revertRegistration();
      const title = page.locator('.navbar__inner .navbar__title');
      await expect(title).toHaveText('Playwright_broke');
    });

    test('my test1', async ({ page }) => {
      currentTest.setMaintainer('emarf');

      // Expect a title "to contain" a substring.
      await expect(page).toHaveTitle(/Playwright/);

      // Expect an attribute "to be strictly equal" to the value.
      await expect(page.locator('text=Get Started').first()).toHaveAttribute('href', '/docs/intro');

      // Expect an element "to be visible".
      await expect(page.locator('text=Learn more').first()).toBeVisible();

      await page.click('text=Get Started');
      // Expect some text to be visible on the page.
      await expect(page.locator('text=Introduction').first()).toBeVisible();
    });
  });
});
