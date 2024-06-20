import {
  CurrentTest,
  CurrentLaunch,
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

test.describe('API Testing with Playwright (1st describe)', () => {
  CurrentLaunch.attachLabel('automation-type', automation_type);
  CurrentLaunch.attachLabel('reporting', 'Zebrunner');
  CurrentLaunch.attachLabel('TCM', 'Zebrunner');

  CurrentLaunch.attachArtifact('./artifacts/zeb.png');
  CurrentLaunch.attachArtifact('./artifacts/txt.txt');

  CurrentLaunch.attachArtifactReference('Zebrunner', 'https://zebrunner.com');

  test('GET /users - should return a list of users (with maintainer)', async ({
    request,
  }) => {
    CurrentTest.attachLog('Describe: 1', 'WARN');
    console.log('Maintainer should be ', maintainer);
    CurrentTest.attachLog('Describe: 1', 'WARN');

    CurrentTest.attachLog(`Maintainer should be ${maintainer}`, 'INFO');
    CurrentTest.setMaintainer(maintainer);

    zebrunner.testCaseKey('DEF-4408', 'KEY-2001');

    //  await timeout(7000);

    const response = await request.get(apiUrl);
    expect(response.status()).toBe(200);

    const users = await response.json();
    expect(users.length).toBeGreaterThan(0);
  });

  test('GET /users/1 - should return a single user (with console.log())', async ({
    request,
  }) => {
    CurrentTest.attachLog(`Maintainer should be ${maintainer}`, 'INFO');
    CurrentTest.setMaintainer(maintainer);

    CurrentTest.attachArtifact('./artifacts/zeb.png');

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

    CurrentTest.attachLog('Custom log message example on test finish', 'INFO');
  });

  test('POST /users - should be @failed', async ({ request }) => {
    CurrentTest.attachLog('Custom log message example on test start', 'INFO');

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

    CurrentTest.attachLog('Custom log message example on test finish', 'INFO');
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

test.describe('JSONPlaceholder Post API tests (2d describe )', () => {
  test('should create a new post and should be passed', async ({ request }) => {
    CurrentTest.attachArtifact('./artifacts/zeb.png');

    testRail.testCaseId('C4', 'C5');
    xray.testCaseKey('ZEB-17', 'ZEB-63');
    zebrunner.testCaseKey('DEF-4156', 'DEF-4359');
    zephyr.testCaseKey('ZEB-T9', 'ZEB-T13');

    CurrentTest.attachLog('Describe: 2', 'WARN');
    const response = await request.post(
      'https://jsonplaceholder.typicode.com/posts',
      {
        data: {
          title: 'New Post',
          body: 'This is a new post created for testing purposes.',
          userId: 1,
        },
      }
    );
    expect(response.status()).toBe(201);
    const responseBody = await response.json();
    expect(responseBody.title).toBe('New Post');
    expect(responseBody.body).toBe(
      'This is a new post created for testing purposes.'
    );
    expect(responseBody.userId).toBe(1);
  });

  test('should get post details and should be failed', async ({ request }) => {
    zebrunner.testCaseKey('DEF-4414', 'DEF-4418');
    CurrentTest.attachLog('Describe: 2', 'WARN');

    const response = await request.get(
      'https://jsonplaceholder.typicode.com/posts/1'
    );
    expect(response.status()).toBe(200);
    const responseBody = await response.json();
    expect(responseBody).toHaveProperty('id', 1);
    expect(responseBody).toHaveProperty('title');
    expect(responseBody).toHaveProperty('body');
    expect(responseBody).toHaveProperty('userId_');
  });
});
