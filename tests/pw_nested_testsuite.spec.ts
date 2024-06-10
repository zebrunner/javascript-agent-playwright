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

  test('test running in Chrome @ff @smoke_test @slow', async ({ page }, testInfo) => {
    CurrentTest.setMaintainer('edovnar');
    const browser = await chromium.launch();
    const page1 = await browser.newPage('https://github.com');

    const screenshot = await page1.screenshot();
    await testInfo.attach('screenshot.png', { body: screenshot, contentType: 'image/png' });

    console.log('Custom Message from console.log');
    CurrentTest.addLog('custom log message after opening browser page');
    zebrunner.testCaseKey('DEF-1231');
    CurrentTest.attachLabel('someTestLabelKey', 'someTestLabelValueOne', 'someTestLabelValueTwo');
    CurrentTest.attachArtifact('C:\\Users\\Mr_Fi\\Desktop\\Zebrunner\\TEST_ARTIFACT.txt');
    CurrentTest.attachArtifactReference('someTestArtifactName', 'https://zebrunner.com');
    await page1.goto('https://zebrunner.com');

    const bufferScreenshot1 = await page1.screenshot();
    CurrentTest.attachArtifact(bufferScreenshot1);
    const bufferScreenshot2 = await page1.screenshot();
    CurrentTest.attachArtifact(bufferScreenshot2, 'screenshot2.png');

    const screenshot2 = await page1.screenshot();
    await testInfo.attach('screenshot.png', { body: screenshot2, contentType: 'image/png' });

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
