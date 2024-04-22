import { defineConfig, devices } from '@playwright/test';

require('dotenv').config();

export default defineConfig({
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
      use: { ...devices['Desktop Safari'] },
    },
  ],
  reporter: [
    [
      '../javascript-agent-playwright',
      {
        enabled: true,
        projectKey: 'DEFFF',
        server: {
          hostname: 'https://react.zebrunner.org',
          accessToken: 'tnd9IQq1qArDi85ZtvM5DGsGG0CpvH6Vyo7CkIc3L95L6qVfss',
        },
        launch: {
          displayName: 'Playwright dev-purposes launch',
          build: '1.0.0',
          environment: 'Local',
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
            onPass: 'SUCCESS',
            onFail: 'FAILED',
          },
          zebrunner: {
            pushResults: false,
            pushInRealTime: false,
            testRunId: 42,
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

        pwConcurrentTasks: 1000,
      },
    ],
  ],
});
