import { expect, test as base } from '@playwright/test';
import type {
  Browser,
  BrowserContext,
  Page,
  PlaywrightTestArgs,
  PlaywrightTestOptions,
  PlaywrightWorkerArgs,
  PlaywrightWorkerOptions,
  TestType,
} from '@playwright/test';

import { currentTest } from '../currentTest';
import { resolveLocalBrowserName, sessionFixtureTimeoutMs, useRemoteSession, useSessionRefresh } from './config';
import { createRemoteSession } from './session';
import type { ManagedRemoteSession, RemoteSession } from './types';
import type { SessionTestFixtures, SessionTestOptions } from './types';

type SessionRuntimeMode = 'local' | 'refresh' | 'per-test';

type SessionInternalFixtures = {
  _sessionRuntime: {
    browser: Browser;
    session?: RemoteSession;
  };
};

type SessionWorkerFixtures = {
  _sessionWorkerRuntime: {
    mode: SessionRuntimeMode;
    browser?: Browser;
    session?: ManagedRemoteSession;
    hasUsedSession: boolean;
  };
};

type SessionTestType = TestType<
  PlaywrightTestArgs & PlaywrightTestOptions & SessionTestFixtures,
  PlaywrightWorkerArgs & PlaywrightWorkerOptions & SessionTestOptions
>;

const extendedTest = base.extend<
  SessionTestFixtures & SessionInternalFixtures,
  SessionTestOptions & SessionWorkerFixtures
>({
  sessionOptions: [{}, { option: true, scope: 'worker' }],

  _sessionWorkerRuntime: [
    async ({ playwright, browserName, headless, channel, launchOptions, sessionOptions }, use) => {
      if (useRemoteSession(sessionOptions)) {
        if (useSessionRefresh(sessionOptions)) {
          const session = await createRemoteSession(playwright, sessionOptions, browserName, headless);
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

      const localBrowserName = resolveLocalBrowserName(sessionOptions, browserName);
      const browser = await playwright[localBrowserName].launch({
        ...launchOptions,
        headless,
        ...(localBrowserName === 'chromium' && channel ? { channel } : {}),
      });
      try {
        await use({ mode: 'local', browser, hasUsedSession: false });
      } finally {
        await browser.close().catch(() => {});
      }
    },
    { scope: 'worker', timeout: sessionFixtureTimeoutMs() },
  ],

  _sessionRuntime: [
    async ({ playwright, browserName, headless, sessionOptions, _sessionWorkerRuntime }, use) => {
      const runtime = _sessionWorkerRuntime;

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
        attachRemoteCapabilities(session);
        await use({ browser: session.browser, session });
        return;
      }

      const session = await createRemoteSession(playwright, sessionOptions, browserName, headless);
      try {
        attachRemoteCapabilities(session);
        await use({ browser: session.browser, session });
      } finally {
        await session.close();
      }
    },
    { auto: true, timeout: sessionFixtureTimeoutMs() },
  ],

  remoteSession: async ({ _sessionRuntime }, use) => {
    if (!_sessionRuntime.session) {
      throw new Error(
        'The test uses a local browser. Set REMOTE_SESSION_ENABLED=true or REMOTE_HOST_URL before you request `remoteSession`.',
      );
    }
    await use(_sessionRuntime.session);
  },

  sessionBrowser: async ({ _sessionRuntime, video }, use) => {
    const session = _sessionRuntime.session;
    const browser = _sessionRuntime.browser;
    const videoMode = typeof video === 'string' ? video : video?.mode;
    const recordLocalVideo = !session && !!videoMode && videoMode !== 'off';

    // Remote runs are recorded server-side, and 'off' means no recording, so
    // hand back the raw browser unchanged.
    if (!recordLocalVideo) {
      await use(browser);
      return;
    }

    // A local run has no grid recording, and a test that builds its own context
    // via `sessionBrowser.newContext()` bypasses the `context` fixture. Wrap the
    // browser so every context it creates records video, and attach it at
    // teardown where the test status is final.
    const testInfo = base.info();
    currentTest.attachSessionCapabilities(localBrowserCapabilities(browser));

    const openContexts = new Set<BrowserContext>();
    const recordedVideos: NonNullable<ReturnType<Page['video']>>[] = [];

    const newContext = async (options?: Parameters<Browser['newContext']>[0]) => {
      // User options win, so a caller can still override recordVideo.
      const context = await browser.newContext({ recordVideo: { dir: testInfo.outputDir }, ...options });
      openContexts.add(context);
      const closeContext = context.close.bind(context);
      (context as { close: BrowserContext['close'] }).close = async (closeOptions) => {
        // Collect page videos before close; the path resolves only afterwards.
        if (openContexts.delete(context)) {
          recordedVideos.push(...pageVideosOf(context));
        }
        await closeContext(closeOptions);
      };
      return context;
    };

    const browserProxy = new Proxy(browser, {
      get(target, property, receiver) {
        if (property === 'newContext') return newContext;
        const value = Reflect.get(target, property, receiver);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });

    try {
      await use(browserProxy as Browser);
    } finally {
      for (const context of [...openContexts]) {
        await context.close().catch(() => {});
      }
      await attachOrDiscardVideos(recordedVideos, testInfo, videoMode);
    }
  },

  context: async (
    {
      _sessionRuntime,
      video,
      // Standard Playwright context options, destructured so the fixture applies
      // them to the context it creates on both local and remote runs.
      acceptDownloads,
      baseURL,
      bypassCSP,
      colorScheme,
      deviceScaleFactor,
      extraHTTPHeaders,
      geolocation,
      hasTouch,
      httpCredentials,
      ignoreHTTPSErrors,
      isMobile,
      javaScriptEnabled,
      locale,
      offline,
      permissions,
      proxy,
      serviceWorkers,
      storageState,
      timezoneId,
      userAgent,
      viewport,
      contextOptions,
    },
    use,
  ) => {
    const session = _sessionRuntime.session;
    // Remote video is the grid's server-side recording, so Playwright-side
    // recording is skipped there. A local run has none, so honor `use.video`
    // by wiring Playwright's recorder and attaching the result for the reporter.
    const videoMode = typeof video === 'string' ? video : video?.mode;
    const recordLocalVideo = !session && !!videoMode && videoMode !== 'off';
    const testInfo = recordLocalVideo ? base.info() : undefined;

    if (recordLocalVideo) {
      // Report the local browser/platform instead of leaving them as "n/a".
      currentTest.attachSessionCapabilities(localBrowserCapabilities(_sessionRuntime.browser));
    }

    const context = await _sessionRuntime.browser.newContext({
      // User `use.*` options first (`contextOptions` is the raw object form; the
      // individual options override it, mirroring Playwright).
      ...contextOptions,
      acceptDownloads,
      baseURL,
      bypassCSP,
      colorScheme,
      deviceScaleFactor,
      extraHTTPHeaders,
      geolocation,
      hasTouch,
      httpCredentials,
      ignoreHTTPSErrors,
      isMobile,
      javaScriptEnabled,
      locale,
      offline,
      permissions,
      proxy,
      serviceWorkers,
      storageState,
      timezoneId,
      userAgent,
      viewport,
      // The remote session dictates its viewport, and local video recording is
      // wired here; both must win over the user options above.
      ...(session ? { viewport: session.defaultViewport } : {}),
      ...(recordLocalVideo && testInfo ? { recordVideo: { dir: testInfo.outputDir } } : {}),
    });
    try {
      await use(context);
    } finally {
      // Collect page videos while the pages are open, then close (the video path
      // only resolves after the page/context closes).
      const pageVideos = recordLocalVideo ? pageVideosOf(context) : [];
      await context.close().catch(() => {});
      if (testInfo) {
        await attachOrDiscardVideos(pageVideos, testInfo, videoMode);
      }
    }
  },

  browser: [
    async ({ playwright }, use) => {
      void playwright;
      void use;
      throw new Error(
        'The `browser` fixture does not own a session. Use `sessionBrowser`, or use the `page` and `context` fixtures.',
      );
    },
    { scope: 'worker' },
  ],
});

/** Browser/platform capabilities reported for a local (non-grid) session. */
function localBrowserCapabilities(browser: Browser): Record<string, string> {
  return {
    browserName: browser.browserType().name(),
    browserVersion: browser.version(),
    platformName: process.platform === 'darwin' ? 'macOS' : process.platform === 'win32' ? 'Windows' : 'Linux',
  };
}

function pageVideosOf(context: BrowserContext): NonNullable<ReturnType<Page['video']>>[] {
  return context
    .pages()
    .map((page) => page.video())
    .filter((videoObj): videoObj is NonNullable<ReturnType<Page['video']>> => videoObj !== null);
}

/** Attaches recorded videos to the test when `use.video` says to keep them, otherwise deletes them. */
async function attachOrDiscardVideos(
  videos: NonNullable<ReturnType<Page['video']>>[],
  testInfo: ReturnType<typeof base.info>,
  videoMode: string | undefined,
): Promise<void> {
  const keep =
    videoMode === 'on' ||
    (videoMode === 'on-first-retry' && testInfo.retry === 1) ||
    (videoMode === 'retain-on-failure' && testInfo.status !== testInfo.expectedStatus);
  for (const videoObj of videos) {
    try {
      if (keep) {
        await testInfo.attach('video', { path: await videoObj.path(), contentType: 'video/webm' });
      } else {
        await videoObj.delete();
      }
    } catch {
      // Best-effort: never fail a test because of local video handling.
    }
  }
}

function attachRemoteCapabilities(session: RemoteSession): void {
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

/** Playwright `test` whose `page`, `context`, and `sessionBrowser` run on a local or ESG session the fixture owns. */
export const test = extendedTest as SessionTestType;

export { expect };
export type { Browser, BrowserContext } from '@playwright/test';
