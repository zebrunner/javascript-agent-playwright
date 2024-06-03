import { test, expect } from '@playwright/test';
import { testRail, xray, zebrunner, zephyr } from '../src/javascript-agent-playwright/index';

test.describe('feature foo', () => {

  test.beforeEach(async ({page}) => {
    // Go to the starting url before each test.
    await page.goto('https://playwright.dev/');
  });

  test('my test', async ({page}) => {
    xray.testCaseKey("ZEB-1");
    zebrunner.testCaseKey("ZEB-1");
    // Assertions use the expect API.
    await expect(page).toHaveURL('https://playwright.dev/');
  });

  test('basic test', async ({page}) => {
    xray.testCaseKey("ZEB-1");
    zebrunner.testCaseKey("ZEB-1");
    const title = page.locator('.navbar__inner .navbar__title');
    await expect(title).toHaveText('Playwright');
  });

  test('my test1', async ({page}) => {
    xray.testCaseKey("ZEB-1");
    testRail.testCaseId("ZEB-1");
    zebrunner.testCaseKey("ZEB-1");
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
