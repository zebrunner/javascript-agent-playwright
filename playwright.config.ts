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
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: {...devices['Desktop Safari']},
    },
  ],
  reporter: [
    [
      './src/lib/ZebrunnerReporter.ts',
      {
        enabled: true,
        reportingServerHostname: 'https://webdriver.zebrunner.com',
        reportingServerAccessToken: 'somesecretaccesstoken',
        reportingProjectKey: 'DEF',
        reportingRunDisplayName: 'PW-tests',
        reportingRunBuild: 'alpha-1',
        reportingRunEnvironment: 'STAGE',
        reportingNotifyOnEachFailure: true,
        reportingNotificationSlackChannels: 'channel1,channel2',
        reportingNotificationMsTeamsChannels: 'channel1,channel2',
        reportingNotificationEmails: 'channel1,channel2',
        reportingMilestoneId: '1',
        reportingMilestoneName: 'test',
        pwConcurrentTasks: 10,
      },
    ],
  ],
};

export default config;
