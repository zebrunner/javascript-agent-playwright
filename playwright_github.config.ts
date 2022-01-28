// playwright.config.ts
import {PlaywrightTestConfig, devices} from '@playwright/test';

const config: PlaywrightTestConfig = {
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  use: {
    trace: 'on',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'webkit',
      use: {...devices['Desktop Safari']},
    },
  ],
  reporter: [
    ['line'],
    [
      './src/lib/ZebrunnerReporter.js',
      {
        reporterBaseUrl: 'https://default.zebrunner.com',
        projectKey: 'DEF',
        enabled: false,
        concurrentTasks: 19,
      },
    ],
  ],
};
export default config;
