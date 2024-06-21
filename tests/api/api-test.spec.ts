import {
  currentTest,
  currentLaunch,
  zebrunner,
  testRail,
  zephyr,
  xray,
} from '../../src/javascript-agent-playwright/index';
import { expect, test } from '@playwright/test';

const apiUrl = 'https://jsonplaceholder.typicode.com/users';
const maintainer = 'testUser';
const automation_type = 'api';

function timeout(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test.describe('API Testing with Playwright', () => {
  currentLaunch.attachLabel('automation-type', automation_type);
  currentLaunch.attachLabel('reporting', 'Zebrunner');
  currentLaunch.attachLabel('TCM', 'Zebrunner');

  currentLaunch.attachArtifact('./artifacts/zeb.png');
  currentLaunch.attachArtifact('./artifacts/txt.txt');

  currentLaunch.attachArtifactReference('Zebrunner', 'https://zebrunner.com');

  test('GET /users - should return a list of users (with maintainer)', async ({ request }) => {
    console.log('Maintainer should be ' + maintainer);

    currentTest.log.info('Maintainer should be ' + maintainer);
    currentTest.setMaintainer(maintainer);

    zebrunner.testCaseKey('DEF-4408', 'KEY-2001');

    //  await timeout(7000);

    const response = await request.get(apiUrl);
    expect(response.status()).toBe(200);

    const users = await response.json();
    expect(users.length).toBeGreaterThan(0);
  });

  test('GET /users/1 - should return a single user (with console.log())', async ({ request }) => {
    currentTest.log.info('Maintainer should be ' + maintainer);
    currentTest.setMaintainer(maintainer);

    currentTest.attachArtifact('./artifacts/zeb.png');

    testRail.testCaseId('C4', 'C5');
    xray.testCaseKey('ZEB-17', 'ZEB-63');
    zebrunner.testCaseKey('DEF-4156', 'DEF-4359');
    zephyr.testCaseKey('ZEB-T9', 'ZEB-T13');

    console.log('Log should be 1');
    console.log('Log should be 2');
    console.log('Log should be 3');
    console.log('Log should be 4');
    console.log('Log should be 5');

    //  await timeout(7000);

    const response = await request.get(`${apiUrl}/1`);
    expect(response.status()).toBe(200);

    const user = await response.json();
    expect(user.id).toBe(1);
    expect(user.name).toBeDefined();
  });

  test('POST /users - should create a new user', async ({ request }) => {
    currentTest.attachLabel('type', 'smoke', 'regression');

    const newUser = {
      name: 'John Doe',
      username: 'johndoe',
      email: 'john.doe@example.com',
    };

    const response = await request.post(apiUrl, {
      data: newUser,
    });
    expect(response.status()).toBe(201);

    const createdUser = await response.json();
    expect(createdUser.id).toBeDefined();
    expect(createdUser.name).toBe(newUser.name);

    currentTest.log.info('Custom log message example on test finish');
  });

  test('POST /users - should be @failed', async ({ request }, testInfo) => {
    currentTest.log.info('Custom log message example on test start');

    const retryCount = `Retry Count: ${testInfo.retry}`;
    currentTest.log.warn(retryCount);

    console.log('This code executes?');

    zebrunner.testCaseKey('DEF-4414', 'DEF-4418');
    zebrunner.testCaseStatus('DEF-4422', 'SKIPPED');

    const newUser = {
      name: 'John Doe',
      username: 'johndoe',
      email: 'john.doe@example.com',
    };

    const response = await request.post(apiUrl, {
      data: newUser,
    });
    expect(response.status()).toBe(200);

    const createdUser = await response.json();
    expect(createdUser.id).toBeDefined();
    expect(createdUser.name).toBe(newUser.name);

    currentTest.log.info('Custom log message example on test finish');
  });

  test.skip('GET /users/1 - should be @skipped', async ({ request }) => {
    const response = await request.get(`${apiUrl}/1`);
    expect(response.status()).toBe(200);

    const user = await response.json();
    expect(user.id).toBe(1);
    expect(user.name).toBeDefined();
  });

  test('Not an important test (This test should not be reported in Zebrunner)', async ({ request }) => {
    currentTest.revertRegistration();
  });
});
