import { expect, test as base } from '@playwright/test';
import type {
  Browser,
  PlaywrightTestArgs,
  PlaywrightTestOptions,
  PlaywrightWorkerArgs,
  PlaywrightWorkerOptions,
  TestType,
} from '@playwright/test';

import { currentTest } from '../currentTest';
import { sessionFixtureTimeoutMs, useRemoteBrowser, useSessionRefresh } from './config';
import { createRemoteSession } from './session';
import type { ManagedRemoteSession, RemoteSession } from './types';
import type { RemoteTestFixtures, RemoteTestOptions } from './types';

type RemoteRuntimeMode = 'local' | 'refresh' | 'per-test';

type RemoteInternalFixtures = {
  _remoteRuntime: {
    browser: Browser;
    session?: RemoteSession;
  };
};

type RemoteWorkerFixtures = {
  _remoteWorkerRuntime: {
    mode: RemoteRuntimeMode;
    browser?: Browser;
    session?: ManagedRemoteSession;
    hasUsedSession: boolean;
  };
};

type RemoteTestType = TestType<
  PlaywrightTestArgs & PlaywrightTestOptions & RemoteTestFixtures,
  PlaywrightWorkerArgs & PlaywrightWorkerOptions & RemoteTestOptions
>;

const extendedTest = base.extend<RemoteTestFixtures & RemoteInternalFixtures, RemoteTestOptions & RemoteWorkerFixtures>(
  {
    remoteOptions: [{}, { option: true, scope: 'worker' }],

    _remoteWorkerRuntime: [
      async ({ playwright, browserName, headless, channel, launchOptions, remoteOptions }, use) => {
        if (useRemoteBrowser(remoteOptions)) {
          if (useSessionRefresh(remoteOptions)) {
            const session = await createRemoteSession(playwright, remoteOptions, browserName, headless);
            try {
              await use({ mode: 'refresh', session, hasUsedSession: false });
            } finally {
              await session.close();
            }
            return;
          }

          await use({ mode: 'per-test', hasUsedSession: false });
          return;
        }

        const browser = await playwright[browserName].launch({
          ...launchOptions,
          headless,
          ...(browserName === 'chromium' && channel ? { channel } : {}),
        });
        try {
          await use({ mode: 'local', browser, hasUsedSession: false });
        } finally {
          await browser.close().catch(() => {});
        }
      },
      { scope: 'worker', timeout: sessionFixtureTimeoutMs() },
    ],

    _remoteRuntime: [
      async ({ playwright, browserName, headless, remoteOptions, _remoteWorkerRuntime }, use) => {
        const runtime = _remoteWorkerRuntime;

        if (runtime.mode === 'local') {
          await use({ browser: runtime.browser as Browser });
          return;
        }

        if (runtime.mode === 'refresh') {
          const session = runtime.session as ManagedRemoteSession;
          if (runtime.hasUsedSession) {
            await session.refresh();
          }
          runtime.hasUsedSession = true;
          attachSessionCapabilities(session);
          await use({ browser: session.browser, session });
          return;
        }

        const session = await createRemoteSession(playwright, remoteOptions, browserName, headless);
        try {
          attachSessionCapabilities(session);
          await use({ browser: session.browser, session });
        } finally {
          await session.close();
        }
      },
      { auto: true, timeout: sessionFixtureTimeoutMs() },
    ],

    remoteSession: async ({ _remoteRuntime }, use) => {
      if (!_remoteRuntime.session) {
        throw new Error(
          'The test uses a local browser. Set REMOTE=true or REMOTE_HOST before you request `remoteSession`.',
        );
      }
      await use(_remoteRuntime.session);
    },

    remoteBrowser: async ({ _remoteRuntime }, use) => {
      await use(_remoteRuntime.browser);
    },

    context: async ({ _remoteRuntime }, use) => {
      const session = _remoteRuntime.session;
      const context = await _remoteRuntime.browser.newContext(
        session ? { viewport: session.defaultViewport } : undefined,
      );
      try {
        await use(context);
      } finally {
        await context.close().catch(() => {});
      }
    },

    browser: [
      async ({ playwright }, use) => {
        void playwright;
        void use;
        throw new Error(
          'The `browser` fixture does not own a remote session. Use `remoteBrowser`, or use the `page` and `context` fixtures.',
        );
      },
      { scope: 'worker' },
    ],
  },
);

function attachSessionCapabilities(session: RemoteSession): void {
  const browser = session.browser;
  currentTest.attachSessionCapabilities(
    {
      browserName: browser.browserType().name(),
      browserVersion: browser.version(),
      platformName: 'linux',
      'zebrunner:provider': 'ZEBRUNNER',
    },
    session.sessionId,
  );
}

/** Playwright `test` whose `page`, `context`, and `remoteBrowser` run on an ESG session the fixture owns. */
export const test = extendedTest as RemoteTestType;

export { expect };
export type { Browser, BrowserContext } from '@playwright/test';
