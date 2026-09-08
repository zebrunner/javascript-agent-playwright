import playwrightPackage from '@playwright/test/package.json';

import type { SessionCapabilities, SessionOptions } from './types';

/** Fully resolved remote config: host, credentials, capabilities, timeouts, and viewport. */
export type ResolvedSessionConfig = {
  host: URL;
  webSocketBaseUrl: URL;
  username: string;
  password: string;
  capabilities: SessionCapabilities;
  createTimeoutMs: number;
  connectTimeoutMs: number;
  refreshTimeoutMs: number;
  deleteTimeoutMs: number;
  defaultViewport: { width: number; height: number } | null;
};

/** Resolves the full remote config from options, environment, and the Playwright browser and headless values. */
export function resolveSessionConfig(
  options: SessionOptions = {},
  playwrightBrowserName = 'chromium',
  playwrightHeadless = false,
): ResolvedSessionConfig {
  const environmentCapabilities = parseCapabilities(optionalEnv('ZEBRUNNER_CAPABILITIES'));
  const explicitCapabilities = options.capabilities || {};
  const playwrightVersion =
    stringValue(explicitCapabilities.playwrightVersion) ||
    stringValue(explicitCapabilities.browserVersion) ||
    stringValue(environmentCapabilities.playwrightVersion) ||
    stringValue(environmentCapabilities.browserVersion) ||
    optionalEnv('REMOTE_PLAYWRIGHT_VERSION') ||
    playwrightPackage.version;
  assertPlaywrightVersion(playwrightVersion);

  const hub = optionalEnv('ZEBRUNNER_HUB_URL');
  const remoteHost = optionalEnv('REMOTE_HOST');
  const selectedHost = options.host || hub || remoteHost;
  const host = parseHttpUrl(selectedHost || '', 'remote host');
  host.pathname = '';
  host.search = '';
  host.hash = '';

  const username = decodeUrlPart(host.username);
  const password = decodeUrlPart(host.password);
  if (!username || !password) {
    throw new Error(`Missing remote credentials for ${host.origin}. Include the user and password in the remote URL.`);
  }

  const browserName =
    stringValue(explicitCapabilities.browserName) ||
    stringValue(environmentCapabilities.browserName) ||
    optionalEnv('SESSION_BROWSER_NAME') ||
    playwrightBrowserName;
  const platformName =
    stringValue(explicitCapabilities.platformName) || stringValue(environmentCapabilities.platformName) || 'playwright';
  const headless =
    booleanValue(explicitCapabilities.headless) ??
    booleanValue(environmentCapabilities.headless) ??
    optionalBooleanEnv('REMOTE_PLAYWRIGHT_HEADLESS') ??
    playwrightHeadless;

  const environmentZebrunnerOptions = objectValue(environmentCapabilities['zebrunner:options']);
  const explicitZebrunnerOptions = objectValue(explicitCapabilities['zebrunner:options']);
  const idleTimeout =
    numberValue(
      explicitCapabilities['zebrunner:idleTimeout'] ?? environmentCapabilities['zebrunner:idleTimeout'],
      'zebrunner:idleTimeout',
    ) ??
    optionalNumberEnv('REMOTE_IDLE_TIMEOUT') ??
    300;
  const capabilities: SessionCapabilities = {
    ...environmentCapabilities,
    ...explicitCapabilities,
    platformName,
    browserName,
    playwrightVersion,
    headless,
    'zebrunner:options': {
      ...environmentZebrunnerDefaults(),
      idleTimeout,
      ...environmentZebrunnerOptions,
      ...explicitZebrunnerOptions,
    },
  };

  const webSocketBaseUrl = defaultWebSocketUrl(host);
  const screenResolution = stringValue(capabilities['zebrunner:options']?.screenResolution);

  return {
    host,
    webSocketBaseUrl,
    username,
    password,
    capabilities,
    createTimeoutMs: timeoutValue(options.createTimeoutMs, 'REMOTE_SESSION_CREATE_TIMEOUT_MS', 600_000),
    connectTimeoutMs: timeoutValue(options.connectTimeoutMs, 'REMOTE_PLAYWRIGHT_CONNECT_TIMEOUT_MS', 120_000),
    refreshTimeoutMs: timeoutValue(options.refreshTimeoutMs, 'REMOTE_PLAYWRIGHT_REFRESH_TIMEOUT_MS', 150_000),
    deleteTimeoutMs: timeoutValue(options.deleteTimeoutMs, 'REMOTE_SESSION_DELETE_TIMEOUT_MS', 30_000),
    defaultViewport: resolveDefaultViewport(browserName, headless, screenResolution),
  };
}

/**
 * Playwright engine to launch for a LOCAL run. Mirrors the remote browser
 * resolution (capabilities, then env) so a config that selects the browser via
 * `sessionOptions.capabilities.browserName` is respected locally too, instead of
 * always launching Playwright's default. Falls back to the Playwright
 * `browserName`. Chrome/Edge map to the chromium engine.
 */
export function resolveLocalBrowserName(
  options: SessionOptions = {},
  playwrightBrowserName: 'chromium' | 'firefox' | 'webkit' = 'chromium',
): 'chromium' | 'firefox' | 'webkit' {
  const explicitCapabilities = options.capabilities || {};
  const environmentCapabilities = parseCapabilities(optionalEnv('ZEBRUNNER_CAPABILITIES'));
  const raw =
    stringValue(explicitCapabilities.browserName) ||
    stringValue(environmentCapabilities.browserName) ||
    optionalEnv('SESSION_BROWSER_NAME') ||
    playwrightBrowserName;
  const name = raw.replace(/^playwright-/, '').toLowerCase();
  if (name === 'chromium' || name === 'chrome' || name === 'edge' || name === 'microsoftedge') return 'chromium';
  if (name === 'firefox') return 'firefox';
  if (name === 'webkit' || name === 'safari') return 'webkit';
  return playwrightBrowserName;
}

/** Reports whether to run on a remote session. Uses `options.remote`, then `REMOTE`, then the presence of a host. */
export function useRemoteSession(options: SessionOptions = {}): boolean {
  if (options.remote !== undefined) return options.remote;
  const remote = optionalBooleanEnv('REMOTE');
  if (remote !== undefined) return remote;
  return Boolean(options.host || optionalEnv('REMOTE_HOST') || optionalEnv('ZEBRUNNER_HUB_URL'));
}

/** Reports whether to reuse one session per worker and refresh it. Uses `options.refresh`, then `REMOTE_REFRESH`. */
export function useSessionRefresh(options: SessionOptions = {}): boolean {
  if (options.refresh !== undefined) return options.refresh;
  return optionalBooleanEnv('REMOTE_REFRESH') ?? false;
}

/** Returns the worker-fixture timeout for the local browser launch or the remote session create and refresh. Default 780000 ms. */
export function sessionFixtureTimeoutMs(): number {
  return timeoutValue(undefined, 'SESSION_FIXTURE_TIMEOUT_MS', 780_000);
}

function optionalEnv(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : undefined;
}

function assertPlaywrightVersion(requestedVersion: string): void {
  if (requestedVersion === playwrightPackage.version) return;
  throw new Error(
    `Playwright version mismatch. Requested ${requestedVersion}, but the current @playwright/test version is ${playwrightPackage.version}.`,
  );
}

function environmentZebrunnerDefaults(): Record<string, unknown> {
  const options: Record<string, unknown> = {
    enableVideo: optionalBooleanEnv('REMOTE_BROWSER_ENABLE_VIDEO') ?? true,
    enableVNC: optionalBooleanEnv('REMOTE_BROWSER_ENABLE_VNC') ?? true,
    enableLog: optionalBooleanEnv('REMOTE_BROWSER_ENABLE_LOG') ?? true,
    enableDebug: optionalBooleanEnv('REMOTE_BROWSER_ENABLE_DEBUG') ?? false,
    screenResolution: optionalEnv('REMOTE_BROWSER_SCREEN_RESOLUTION') || '1920x1080x24',
  };
  const optionalValues: Record<string, string | number | undefined> = {
    cpu: optionalNumberEnv('REMOTE_BROWSER_CPU'),
    memory: optionalNumberEnv('REMOTE_BROWSER_MEMORY'),
    maxTimeout: optionalNumberEnv('REMOTE_MAX_TIMEOUT'),
    videoScreenSize: optionalEnv('REMOTE_BROWSER_VIDEO_SCREEN_SIZE'),
    frameRate: optionalNumberEnv('REMOTE_BROWSER_FRAME_RATE'),
    timeZone: optionalEnv('REMOTE_BROWSER_TIME_ZONE'),
  };
  for (const [key, value] of Object.entries(optionalValues)) {
    if (value !== undefined) options[key] = value;
  }
  return options;
}

function optionalNumberEnv(name: string): number | undefined {
  const raw = optionalEnv(name);
  if (raw === undefined) return undefined;
  return numberValue(raw, name);
}

function optionalBooleanEnv(name: string): boolean | undefined {
  const raw = optionalEnv(name)?.toLowerCase();
  if (raw === undefined) return undefined;
  if (raw === 'true' || raw === '1') return true;
  if (raw === 'false' || raw === '0') return false;
  throw new Error(`${name} must be true or false.`);
}

function parseHttpUrl(raw: string, name: string): URL {
  if (!raw) {
    throw new Error('Missing remote host. Set ZEBRUNNER_HUB_URL or REMOTE_HOST.');
  }
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw new Error(`${name} must be a valid HTTP or HTTPS URL.`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`${name} must use HTTP or HTTPS.`);
  }
  return url;
}

function defaultWebSocketUrl(host: URL): URL {
  const url = new URL(host.origin);
  url.protocol = url.protocol === 'http:' ? 'ws:' : 'wss:';
  url.pathname = '/ws/playwright';
  return url;
}

function decodeUrlPart(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function parseCapabilities(raw?: string): SessionCapabilities {
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('ZEBRUNNER_CAPABILITIES must be a JSON object.');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('ZEBRUNNER_CAPABILITIES must be a JSON object.');
  }
  return parsed as SessionCapabilities;
}

function timeoutValue(explicit: number | undefined, envName: string, fallback: number): number {
  const raw = explicit ?? optionalNumberEnv(envName) ?? fallback;
  if (!Number.isFinite(raw) || raw < 0) {
    throw new Error(`${envName} must be a non-negative number.`);
  }
  return raw;
}

// Headed Chromium fills its own maximized window, so a client viewport would clip the top.
function resolveDefaultViewport(
  browserName: string,
  headless: boolean,
  screenResolution?: string,
): { width: number; height: number } | null {
  if (!headless && isChromiumFamily(browserName)) return null;
  return parseScreenResolution(screenResolution);
}

function isChromiumFamily(browserName: string): boolean {
  const name = browserName.replace(/^playwright-/, '').toLowerCase();
  return name === 'chromium' || name === 'chrome' || name === 'edge' || name === 'microsoftedge';
}

function parseScreenResolution(value?: string): { width: number; height: number } {
  const match = value ? /^(\d+)x(\d+)/.exec(value.trim()) : null;
  if (!match) return { width: 1920, height: 1080 };
  return { width: Number(match[1]), height: Number(match[2]) };
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function booleanValue(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function numberValue(value: unknown, name: string): number | undefined {
  if (value === undefined || value === null || (typeof value === 'string' && !value.trim())) return undefined;
  const number = typeof value === 'number' || typeof value === 'string' ? Number(value) : Number.NaN;
  if (!Number.isFinite(number) || number < 0) {
    throw new Error(`${name} must be a non-negative number.`);
  }
  return number;
}
