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
          hostname: 'https://integration.zebrunner.org',
          accessToken: 'TCIryaD5kZiTXQquHnptPLev4C1VyF2rZZ8cvGpnYdOibDvjbl',

          // hostname: "https://automationzbr.zebrunner.com",
          // accessToken: "etB4xYygItPqgirfZCrbeSlAuToQZguv6qCP6eoakljuXon0cD",
        },
        launch: {
          displayName: 'Playwright dev launch',
          build: '1.0.0',
          environment: 'Local',
        },
        milestone: {
          // id: '76', // "from env var" id
          // name: 'milestoneNameFromConfig',
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
      },
    ],
  ],
});
