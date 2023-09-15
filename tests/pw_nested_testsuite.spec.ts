import { expect, test } from '@playwright/test';
import { CurrentTest } from '../src/lib/current-test';
const {firefox} = require('playwright');

test.describe('nested foo', () => {
  test('test runnin in Firery fox @ff @smoke_test @slow', async ({page}, testInfo) => {
    CurrentTest.setMaintainer('emarf');

    const browser = await firefox.launch();
    const page1 = await browser.newPage();
    await page1.goto('https://example.com');
    await browser.close();
  });

  test.describe('foo - l2 ', () => {
    test.beforeEach(async ({page}) => {
      // Go to the starting url before each test.
      await page.goto('https://playwright.dev/');
    });

    test('my test', async ({page}) => {
      // Assertions use the expect API.
      await expect(page).toHaveURL('https://playwright.dev/');
    });

    test('basic test @broke', async ({page}, testInfo) => {
      // testInfo.annotations.push({type: 'maintainer', description: 'emarf'});
      const title = page.locator('.navbar__inner .navbar__title');
      await expect(title).toHaveText('Playwright_broke');
    });

    test('my test1', async ({page}) => {
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
