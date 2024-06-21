// @ts-check
import { currentTest, currentLaunch } from '../src/javascript-agent-playwright/index';

const { test, expect } = require('@playwright/test');

const maintainer = 'testUser';
const automation_type = 'web';

test.describe('Web Testing with Playwright', () => {
  test.beforeAll(async () => {
    // will be attached to the entire run
    currentLaunch.attachLabel('automation-type', automation_type);
    currentLaunch.attachArtifactReference('Zebrunner', 'https://zebrunner.com');
  });

  test('Has title (with maintainer)', async ({ page }) => {
    currentTest.setMaintainer(maintainer);
    currentTest.log.info('Custom log message example on test start');

    currentLaunch.attachArtifact('./artifacts/zeb.png');
    currentTest.attachArtifactReference('Zebrunner', 'https://zebrunner.com');

    console.log('Maintainer should be ' + maintainer);

    await page.goto('https://playwright.dev/');

    // Expect a title "to contain" a substring.
    await expect(page).toHaveTitle(/Playwright/);

    currentTest.log.info('Custom log message example on test finish');
  });

  test('Get started link (with console.log() and custom screenshots and logs)', async ({
    page,
  }, testInfo) => {
    currentTest.setMaintainer(maintainer);

    currentTest.log.info('INFO level log message on test start');

    currentTest.log.info('Navigating to Google...');

    await page.goto('https://www.google.com/');
    currentTest.attachScreenshot(await page.screenshot());

    await page.goto('https://playwright.dev/');
    currentTest.attachScreenshot(await page.screenshot());

    // Click the get started link.
    await page.getByRole('link', { name: 'Get started' }).click();

    // Expects page to have a heading with the name of Installation.
    await expect(
      page.getByRole('heading', { name: 'Installation' })
    ).toBeVisible();

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

    currentTest.log.info(
      'Custom log message example on test finish (without log level, by default should be INFO 8)'
    );
    currentTest.log.info('Attaching screenshot after all logs');
    currentTest.attachScreenshot(await page.screenshot());
  });

  test('Get started link incorrect - should be @failed', async ({
    page,
    browser,
  }, testInfo) => {
    currentTest.setMaintainer(maintainer);

    const retryCount = `Retry Count: ${testInfo.retry}`;
    currentTest.log.warn(retryCount);

    const browserType = browser.browserType().name();
    console.log('Browser Type:', browserType);

    // Логирование версии браузера
    const version = await browser.version();
    console.log('Browser Version:', version);

    currentTest.log.info('Custom log message example on test start');
    currentTest.attachLabel('reporting', 'Zebrunner');

    await page.goto('https://playwright.dev/');
    currentTest.attachScreenshot(await page.screenshot());

    // Click the get started link.
    await expect(
      page.getByRole('link', { name: 'Get started - Oops!' })
    ).toBeVisible();

    currentTest.log.info('Custom log message example on test finish');
  });

  test('Get started link incorrect - should be @aborted', async ({
    page,
  }, testInfo) => {
    currentTest.setMaintainer(maintainer);

    currentTest.attachLabel('type', 'smoke', 'regression');

    await page.goto('https://playwright.dev/');
    currentTest.attachScreenshot(await page.screenshot());

    // Click the get started link.
    await page.getByRole('link', { name: 'Get started - Oops!' }).click();

    // Expects page to have a heading with the name of Installation.
    await expect(
      page.getByRole('heading', { name: 'Installation' })
    ).toBeVisible();
  });

  test.skip('Get started link - should be @skipped', async ({ page }) => {
    await page.goto('https://playwright.dev/');

    // Click the get started link.
    await page.getByRole('link', { name: 'Get started' }).click();

    // Expects page to have a heading with the name of Installation.
    await expect(
      page.getByRole('heading', { name: 'Installation' })
    ).toBeVisible();

    currentTest.log.info('Custom log message example on test finish');
  });

  test('Skipped inside in test', async ({ page }, testInfo) => {
    currentTest.attachArtifactReference('Zebrunner', 'https://zebrunner.com');
    currentTest.attachArtifact('./artifacts/zeb.png');

    currentTest.attachLabel('type', 'smoke');
    currentTest.setMaintainer(maintainer);

    await page.goto('https://example.com');
    currentTest.log.warn('This test should be skipped!)');
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
