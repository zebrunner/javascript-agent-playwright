// playwright.config.ts
import {PlaywrightTestConfig, devices} from '@playwright/test';
require('dotenv').config();

const config: PlaywrightTestConfig = {
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  use: {
    video: 'on',
    trace: 'on',
    screenshot: 'only-on-failure',
  },
  projects: [
    // {
    //   name: 'chromium',
    //   use: { ...devices['Desktop Chrome'] },
    // },
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
  reporter: [
    [
      './src/lib/zebReporter.ts',
      {
        reporterBaseUrl: 'https://webdriver.zebrunner.com',
        projectKey: 'DEF',
        enabled: true,
        concurrentTasks: 19,
        slackEnabled: true,
        slackDisplayNumberOfFailures: 10,
        slackReportOnlyOnFailures: true,
        slackReportingChannels: 'zeb,general',
        slackStacktraceLength: 270,
      },
    ],
  ],
};
export default config;
