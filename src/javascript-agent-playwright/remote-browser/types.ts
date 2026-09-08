import type { Browser, BrowserContextOptions } from '@playwright/test';

/**
 * ESG session capabilities. Extra keys pass through to the create request, and
 * `zebrunner:options` carries the Zebrunner-specific settings.
 */
export type SessionCapabilities = Record<string, unknown> & {
  /** Engine to request: `chromium`, `firefox`, or `webkit`. */
  browserName?: string;
  /** Playwright image tag, for example `1.58.2`. Defaults to the installed `@playwright/test` version. */
  playwrightVersion?: string;
  /** Platform label sent to ESG. Defaults to `playwright`. */
  platformName?: string;
  /** Whether the remote browser runs headless. */
  headless?: boolean;
  /** Zebrunner session options, such as CPU, memory, video, and timeouts. */
  'zebrunner:options'?: Record<string, unknown>;
};

/** Per-run session configuration. Every field falls back to an environment variable when omitted. */
export type SessionOptions = {
  /** Force remote (`true`) or local (`false`). Defaults from `REMOTE`, then from the presence of a host. */
  remote?: boolean;
  /** Reuse one session per worker and refresh it between tests. Defaults from `REMOTE_REFRESH`. */
  refresh?: boolean;
  /** Remote host with the credentials in the URL. Defaults from `ZEBRUNNER_HUB_URL`, then `REMOTE_HOST`. */
  host?: string;
  /** Capabilities merged into the create request. */
  capabilities?: SessionCapabilities;
  /** Timeout for `POST /session`, in milliseconds. */
  createTimeoutMs?: number;
  /** Timeout for the WebSocket connect, in milliseconds. */
  connectTimeoutMs?: number;
  /** Timeout for the refresh request, in milliseconds. */
  refreshTimeoutMs?: number;
  /** Timeout for `DELETE /session`, in milliseconds. */
  deleteTimeoutMs?: number;
};

/** Result of a refresh: the new browser IDs and the browser generation count. */
export type RemoteRefreshResult = {
  /** ID of the new browser. Used for the WebSocket reconnect. */
  sessionId: string;
  /** Root session that owns the ECS task. Used for the delete. */
  originalSessionId: string;
  /** Engine of the new browser, for example `playwright-chromium`. */
  browserType?: string;
  /** Count of browsers the task has started. Increases on each refresh. */
  generation?: number;
};

/** Options for a refresh request. */
export type RemoteRefreshOptions = {
  /** Engine to start after the refresh. Defaults to the current engine. */
  browserName?: string;
};

/** A live ESG session with the remote-only endpoints (clipboard and downloads). */
export interface RemoteSession {
  /** ID of the current browser. */
  readonly sessionId: string;
  /** Root session that owns the ECS task. */
  readonly originalSessionId: string;
  /** Engine of the current browser. */
  readonly browserName: string;
  /** Browser generation count. Increases on each refresh. */
  readonly generation?: number;
  /** The connected Playwright browser. */
  readonly browser: Browser;
  /** Viewport the fixture applies to new contexts, or `null` to let the window drive the size. */
  readonly defaultViewport: { width: number; height: number } | null;

  /** Creates a context with the session default viewport unless the options set one. */
  newContext(options?: BrowserContextOptions): ReturnType<Browser['newContext']>;
  /** Writes text to the session clipboard. */
  setClipboard(text: string): Promise<void>;
  /** Reads the session clipboard. */
  getClipboard(): Promise<string>;
  /** Returns the fileserver URL for a download name, or the list URL when the name is empty. */
  downloadUrl(name?: string): string;
  /** Lists the download file names, newest first. */
  listDownloads(): Promise<string[]>;
  /** Fetches one download through the fileserver. */
  fetchDownload(name: string): Promise<Response>;
  /** Deletes one download from the fileserver. */
  deleteDownload(name: string): Promise<void>;
}

/** A `RemoteSession` the fixture owns, with the lifecycle calls the tests do not use directly. */
export interface ManagedRemoteSession extends RemoteSession {
  /** Refreshes the browser inside the same task and reconnects. Returns the new browser. */
  refresh(options?: RemoteRefreshOptions | string): Promise<Browser>;
  /** Disconnects and sends `DELETE /session`. Safe to call more than once. */
  close(): Promise<void>;
}

/** Worker-scoped test option that configures the session for the run (local or remote). */
export type SessionTestOptions = {
  /** The session configuration for the run. Set it per project or with `test.use`. */
  sessionOptions: SessionOptions;
};

/** Fixtures the session `test` adds. */
export type SessionTestFixtures = {
  /** The live ESG session. Throws during a local run. */
  remoteSession: RemoteSession;
  /** The browser under test: a local browser locally, or the remote browser on the grid. */
  sessionBrowser: Browser;
};
