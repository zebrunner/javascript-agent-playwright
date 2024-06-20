import { expect, test } from '@playwright/test';
import { CurrentTest, zebrunner, CurrentLaunch } from '../src/javascript-agent-playwright/index';
const { chromium } = require('playwright');
import * as fs from 'fs';

test.describe('nested foo', () => {
  test.beforeAll(async () => {
    CurrentLaunch.attachLabel('test_run_label_key', 'run_label_value_one', 'run_label_value_two');
    CurrentLaunch.attachArtifactReference('someRunArtifactName', 'https://zebrunner.com');
    CurrentLaunch.attachArtifact('C:\\Users\\Mr_Fi\\Desktop\\Zebrunner\\TEST_ARTIFACT.txt');
    const bufferFileOne = fs.readFileSync('C:\\Users\\Mr_Fi\\Desktop\\Zebrunner\\TEST_ARTIFACT2.txt');
    CurrentLaunch.attachArtifact(bufferFileOne);
  });

  test('Get started link (with console.log() and custom screenshots and logs)', async ({ page }, testInfo) => {
    CurrentTest.setMaintainer('edovnar');

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
    //await expect(page.getByRole('heading', { name: '1231231313' })).toBeVisible();

    CurrentTest.attachLog('BEFORE Attaching screenshot via PATH on disk', 'WARN');
    CurrentTest.attachScreenshot(await page.screenshot());
    //CurrentTest.attachLog('AFTER Attaching screenshot via PATH on disk', 'WARN');

    console.log('Log should be 1');
    console.log('Log should be 2');
    console.log('Log should be 3');
    console.log('Log should be 4');
    console.log('Log should be 5');

    CurrentTest.attachArtifact('C:\\Users\\Mr_Fi\\Desktop\\Zebrunner\\TEST_ARTIFACT.txt');
    CurrentTest.attachArtifactReference('referenceT.txt', 'https://google.com');

    CurrentTest.attachLog('INFO level log message 1', 'INFO');
    CurrentTest.attachLog('ERROR level log message 2', 'ERROR');
    CurrentTest.attachLog('WARN level log message 3', 'WARN');
    CurrentTest.attachLog('FATAL level log message 4', 'FATAL');
    CurrentTest.attachLog('DEBUG level log message 5', 'DEBUG');
    CurrentTest.attachLog('TRACE level log message 6', 'TRACE');

    CurrentTest.attachLog('CUSTOM string level log message 7', 'CUSTOM');

    CurrentTest.attachLog('Custom log message example on test finish (without log level, by default should be INFO 8)');
  });

  test('Skipped inside in test', async ({ page }, testInfo) => {
    CurrentLaunch.attachArtifactReference('Zebrunner', 'https://zebrunner.com');
    CurrentTest.attachArtifact('C:\\Users\\Mr_Fi\\Desktop\\Zebrunner\\TEST_ARTIFACT.txt');
    CurrentTest.attachLabel('type', 'smoke');
    CurrentTest.setMaintainer('edovnar');

    await page.goto('https://example.com');
    CurrentTest.attachLog('This test should be skipped!)', 'WARN');
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
    CurrentTest.setMaintainer('edovnar');
    const browser = await chromium.launch();
    const page1 = await browser.newPage('https://github.com');

    console.log('Custom Message from console.log');
    CurrentTest.attachLog('NO PARAMETER custom log message');

    CurrentTest.attachLog('INFO level log message', 'INFO');
    CurrentTest.attachLog('DEBUG level log message', 'DEBUG');
    CurrentTest.attachLog('ERROR level log message', 'ERROR');
    CurrentTest.attachLog('WARN level log message', 'WARN');
    CurrentTest.attachLog('TRACE level log message', 'TRACE');
    CurrentTest.attachLog('FATAL level log message', 'FATAL');

    CurrentTest.attachLog('CUSTOM string level log message', 'CUSTOM');

    zebrunner.testCaseKey('DEF-1231');
    zebrunner.testCaseStatus('DEF-1249', 'Retest');
    CurrentTest.attachLabel('someTestLabelKey', 'someTestLabelValueOne', 'someTestLabelValueTwo');
    CurrentTest.attachArtifact('C:\\Users\\Mr_Fi\\Desktop\\Zebrunner\\TEST_ARTIFACT.txt');
    CurrentTest.attachArtifactReference('someTestArtifactName', 'https://zebrunner.com');
    await page1.goto('https://zebrunner.com');

    const bufferScreenshot1 = await page1.screenshot();
    CurrentTest.attachArtifact(bufferScreenshot1);
    const bufferScreenshot2 = await page1.screenshot();
    CurrentTest.attachArtifact(bufferScreenshot2, 'screenshot2.png');

    CurrentTest.attachScreenshot(await page1.screenshot());

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
      CurrentTest.revertRegistration();
      const title = page.locator('.navbar__inner .navbar__title');
      await expect(title).toHaveText('Playwright_broke');
    });

    test('my test1', async ({ page }) => {
      CurrentTest.setMaintainer('emarf');

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
