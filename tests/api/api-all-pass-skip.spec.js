import {
  CurrentTest,
  CurrentLaunch,
  zebrunner,
  testRail,
} from '../../src/javascript-agent-playwright/index';
import { expect, test } from '@playwright/test';

const apiUrl = 'https://jsonplaceholder.typicode.com/users';
const maintainer = 'testUser';
const automation_type = 'api';

function timeout(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test.describe('API Testing with Playwright', () => {
  CurrentLaunch.attachLabel('automation-type', automation_type);
  CurrentLaunch.attachLabel('reporting', 'Zebrunner');
  CurrentLaunch.attachLabel('TCM', 'Zebrunner');

  CurrentLaunch.attachArtifact('./artifacts/zeb.png');
  CurrentLaunch.attachArtifact('./artifacts/txt.txt');

  CurrentLaunch.attachArtifactReference('Zebrunner', 'https://zebrunner.com');

  test('GET /users - should return a list of users (with maintainer)', async ({
    request,
  }) => {
    console.log('Maintainer should be ' + maintainer);

    CurrentTest.attachLog('Maintainer should be ' + maintainer);
    CurrentTest.setMaintainer(maintainer);

    zebrunner.testCaseKey('DEF-4408', 'KEY-2001');

    //  await timeout(7000);

    const response = await request.get(apiUrl);
    expect(response.status()).toBe(200);

    const users = await response.json();
    expect(users.length).toBeGreaterThan(0);
  });

  test.skip('GET /users/1 - should return a single user (with console.log())', async ({
    request,
  }) => {
    CurrentTest.attachLog('Maintainer should be ' + maintainer);
    CurrentTest.setMaintainer(maintainer);

    CurrentTest.attachArtifact('./artifacts/zeb.png');

    testRail.testCaseId('C4', 'C5');

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

  test.skip('POST /users - should create a new user', async ({ request }) => {
    CurrentTest.attachLabel('type', 'smoke', 'regression');

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

    CurrentTest.attachLog('Custom log message example on test finish');
  });

  test.skip('POST /users - should be @failed', async ({ request }) => {
    CurrentTest.attachLog('Custom log message example on test start');

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

    CurrentTest.attachLog('Custom log message example on test finish');
  });

  test.skip('GET /users/1 - should be @skipped', async ({ request }) => {
    const response = await request.get(`${apiUrl}/1`);
    expect(response.status()).toBe(200);

    const user = await response.json();
    expect(user.id).toBe(1);
    expect(user.name).toBeDefined();
  });

  test('Not an important test (This test should not be reported in Zebrunner)', async ({
    request,
  }) => {
    CurrentTest.revertRegistration();
  });
});
