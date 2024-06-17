import { defineConfig, devices } from '@playwright/test';

require('dotenv').config();

export default defineConfig({
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  use: {
    video: 'on',
    trace: 'on',
    screenshot: 'on',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],
  reporter: [
    [
      './src/javascript-agent-playwright/index',
      {
        enabled: true,
        projectKey: 'DEF',
        server: {
          hostname: 'https://domain.zebrunner.com',
          accessToken: 'token',
        },
        launch: {
          displayName: 'Playwright launch',
          build: '1.0.0',
          environment: 'Local',
          locale: 'en_US',
          treatSkipsAsFailures: true,
        },
        logs: {
          ignorePlaywrightSteps: false,
          useLinesFromSourceCode: true,
          ignoreConsole: false,
          ignoreCustom: false,
          ignoreManualScreenshots: false,
          ignoreAutoScreenshots: false,
        },
        milestone: {
          id: null,
          name: null,
        },
        notifications: {
          notifyOnEachFailure: false,
          slackChannels: 'dev, qa',
          teamsChannels: 'dev-channel, management',
          emails: 'yourEmail@gmail.com',
        },
        tcm: {
          testCaseStatus: {
            onPass: 'retest',
            onFail: 'skipped',
            onSkip: 'invalid',
          },
          zebrunner: {
            pushResults: true,
            pushInRealTime: false,
            testRunId: 815,
          },
          testRail: {
            pushResults: false,
            pushInRealTime: false,
            suiteId: 100,
            runId: 500,
            includeAllTestCasesInNewRun: true,
            runName: 'New Demo Run',
            milestoneName: 'Demo Milestone',
            assignee: 'tester@mycompany.com',
          },
          xray: {
            pushResults: false,
            pushInRealTime: false,
            executionKey: 'QT-100',
          },
          zephyr: {
            pushResults: false,
            pushInRealTime: false,
            jiraProjectKey: 'ZEB',
            testCycleKey: 'ZEB-T1',
          },
        },
      },
    ],
  ],
});
