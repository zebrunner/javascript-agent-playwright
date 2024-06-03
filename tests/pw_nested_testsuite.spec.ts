import { expect, test } from '@playwright/test';
import { CurrentTest } from '../src/javascript-agent-playwright/index';
import { CurrentLaunch } from '../src/javascript-agent-playwright/index';
const { chromium } = require('playwright');

test.describe('nested foo', () => {
  test.beforeAll(async () => {
    CurrentLaunch.attachLabel('test_run_label_key', 'run_label_value_one', 'run_label_value_two');
    CurrentLaunch.attachArtifactReference('someRunArtifactName', 'https://zebrunner.com');
  });

  test('test running in Chrome @ff @smoke_test @slow', async ({ page }, testInfo) => {
    CurrentTest.setMaintainer('edovnar');
    const browser = await chromium.launch();
    const page1 = await browser.newPage('https://google.com');
    CurrentTest.addLog('custom log message after opening browser page');
    CurrentTest.attachLabel('someTestLabelKey', 'someTestLabelValueOne', 'someTestLabelValueTwo');
    CurrentTest.attachArtifactReference('someTestArtifactName', 'https://zebrunner.com');
    await page1.goto('https://zebrunner.com');
    await page1.screenshot();
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
