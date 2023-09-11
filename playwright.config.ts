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
      './src/lib/ZebrunnerReporter.ts',
      {
        enabled: true,
        projectKey: 'DEF',
        server: {
          hostname: 'https://dkazaktest.zebrunner.org',
          accessToken: '7wkj2ZxyhN2s78e25cez6ZLWpId4Kza2ql1dYboObH0ugJDJo4'
        },
        launch: {
          displayName: "Playwright launch",
          build: '1.0.0',
          environment: 'Local'
        },
        milestone: {
          id: null,
          name: null
        },
        notifications: {
          notifyOnEachFailure: false,
          slackChannels: 'dev, qa',
          teamsChannels: 'dev-channel, management',
          emails: 'dkazak@zebrunner.com'
        },
        tcm: {
          testCaseStatus: {
            onPass: 'SUCCESS',
            onFail: 'FAILED',
          },
          zebrunner: {
            pushResults: false,
            pushInRealTime: false,
            testRunId: 42
          },
          testRail: {
            pushResults: false,
            pushInRealTime: false,
            suiteId: 100,
            runId: 500,
            includeAllTestCasesInNewRun: true,
            runName: 'New Demo Run',
            milestoneName: 'Demo Milestone',
            assignee: 'tester@mycompany.com'
          },
          xray: {
            pushResults: false,
            pushInRealTime: false,
            executionKey: 'QT-100'
          },
          zephyr: {
            pushResults: false,
            pushInRealTime: false,
            jiraProjectKey: 'ZEB',
            testCycleKey: 'ZEB-T1'
          }
        }
      }
    ],
  ],
});
