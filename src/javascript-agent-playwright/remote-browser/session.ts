import type { Browser, BrowserContext, BrowserContextOptions, BrowserType } from '@playwright/test';

import { resolveRemoteConfig, type ResolvedRemoteConfig } from './config';
import type { ManagedRemoteSession, RemoteOptions, RemoteRefreshOptions, RemoteRefreshResult } from './types';

type RemoteResponse = Record<string, unknown>;

type PlaywrightApi = {
  chromium: BrowserType;
  firefox: BrowserType;
  webkit: BrowserType;
};

type ManagedSessionState = {
  sessionId: string;
  originalSessionId: string;
  browserName: string;
  browserType?: string;
  generation?: number;
};

/** Creates an ESG session, connects Playwright over the WebSocket, and returns the managed session. */
export async function createRemoteSession(
  playwright: PlaywrightApi,
  options: RemoteOptions = {},
  playwrightBrowserName = 'chromium',
  playwrightHeadless = false,
): Promise<ManagedRemoteSession> {
  const config = resolveRemoteConfig(options, playwrightBrowserName, playwrightHeadless);
  const sessionUrl = endpoint(config.host, 'session');
  const response = await fetch(sessionUrl, {
    method: 'POST',
    headers: {
      Authorization: basicAuthorization(config.username, config.password),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ capabilities: { alwaysMatch: config.capabilities } }),
    signal: AbortSignal.timeout(config.createTimeoutMs),
  });
  const body = await readJson(response, 'POST /session', config.host.origin);
  assertSuccessfulResponse(response, body, 'POST /session');

  const sessionId = responseSessionId(body);
  if (!sessionId) {
    throw new Error(`POST /session returned no sessionId: ${safeBody(body)}`);
  }

  const state: ManagedSessionState = {
    sessionId,
    originalSessionId: sessionId,
    browserName: String(config.capabilities.browserName || playwrightBrowserName),
    generation: 1,
  };
  const session = new ManagedRemoteSessionImpl(playwright, config, state);
  try {
    await session.connect();
    return session;
  } catch (error) {
    await session.close();
    throw error;
  }
}

class ManagedRemoteSessionImpl implements ManagedRemoteSession {
  private activeBrowser?: Browser;
  private closed = false;

  constructor(
    private readonly playwright: PlaywrightApi,
    private readonly config: ResolvedRemoteConfig,
    private readonly state: ManagedSessionState,
  ) {}

  get sessionId(): string {
    return this.state.sessionId;
  }

  get originalSessionId(): string {
    return this.state.originalSessionId;
  }

  get browserName(): string {
    return this.state.browserName;
  }

  get generation(): number | undefined {
    return this.state.generation;
  }

  get browser(): Browser {
    if (!this.activeBrowser) {
      throw new Error('The remote browser is not connected.');
    }
    return this.activeBrowser;
  }

  get defaultViewport(): { width: number; height: number } | null {
    return this.config.defaultViewport;
  }

  async connect(): Promise<void> {
    this.assertOpen();
    const browserType = browserTypeFor(this.playwright, this.state.browserType || this.state.browserName);
    this.activeBrowser = await browserType.connect(webSocketEndpoint(this.config.webSocketBaseUrl, this.sessionId), {
      timeout: this.config.connectTimeoutMs,
    });
  }

  async refresh(options: RemoteRefreshOptions | string = {}): Promise<Browser> {
    this.assertOpen();
    const requestedBrowserName = typeof options === 'string' ? options : options.browserName || this.state.browserName;

    await this.disconnect();
    const label = `POST /playwright/${this.sessionId}/refresh`;
    const response = await fetch(endpoint(this.config.host, 'playwright', this.sessionId, 'refresh'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ browserName: requestedBrowserName }),
      signal: AbortSignal.timeout(this.config.refreshTimeoutMs),
    });
    const body = await readJson(response, label, this.config.host.origin);
    assertSuccessfulResponse(response, body, label);

    const result = refreshResult(body, this.originalSessionId);
    this.state.sessionId = result.sessionId;
    this.state.originalSessionId = result.originalSessionId;
    this.state.browserType = result.browserType || requestedBrowserName;
    this.state.browserName = requestedBrowserName;
    this.state.generation = result.generation;
    await this.connect();
    return this.browser;
  }

  newContext(options?: BrowserContextOptions): Promise<BrowserContext> {
    const viewport = options && 'viewport' in options ? options.viewport : this.config.defaultViewport;
    return this.browser.newContext({ ...options, viewport });
  }

  async setClipboard(text: string): Promise<void> {
    this.assertOpen();
    const label = `POST /clipboard/${this.sessionId}`;
    const response = await fetch(endpoint(this.config.host, 'clipboard', this.sessionId), {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      body: text,
    });
    await assertResponseOk(response, label);
  }

  async getClipboard(): Promise<string> {
    this.assertOpen();
    const label = `GET /clipboard/${this.sessionId}`;
    const response = await fetch(endpoint(this.config.host, 'clipboard', this.sessionId));
    await assertResponseOk(response, label);
    return response.text();
  }

  downloadUrl(name = ''): string {
    this.assertOpen();
    return endpoint(this.config.host, 'download', this.sessionId, name).toString();
  }

  async listDownloads(): Promise<string[]> {
    this.assertOpen();
    const label = `GET /download/${this.sessionId}/?json`;
    const url = new URL(this.downloadUrl());
    url.search = '?json';
    const response = await fetch(url);
    await assertResponseOk(response, label);
    const text = (await response.text()).trim();
    let parsed: unknown;
    try {
      parsed = text ? JSON.parse(text) : [];
    } catch {
      throw new Error(`${label} returned invalid JSON: ${text.slice(0, 500)}`);
    }
    if (!Array.isArray(parsed) || parsed.some((name) => typeof name !== 'string')) {
      throw new Error(`${label} returned an invalid file list: ${text.slice(0, 500)}`);
    }
    return parsed;
  }

  async fetchDownload(name: string): Promise<Response> {
    this.assertOpen();
    const label = `GET /download/${this.sessionId}/${name}`;
    const response = await fetch(this.downloadUrl(name));
    await assertResponseOk(response, label);
    return response;
  }

  async deleteDownload(name: string): Promise<void> {
    this.assertOpen();
    const label = `DELETE /download/${this.sessionId}/${name}`;
    const response = await fetch(this.downloadUrl(name), { method: 'DELETE' });
    await assertResponseOk(response, label);
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    await this.disconnect();
    try {
      const response = await fetch(endpoint(this.config.host, 'session', this.originalSessionId), {
        method: 'DELETE',
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(this.config.deleteTimeoutMs),
      });
      if (!response.ok) {
        console.warn(`DELETE /session/${this.originalSessionId} returned ${response.status}.`);
      }
    } catch (error) {
      console.warn(`DELETE /session/${this.originalSessionId} failed: ${errorMessage(error)}`);
    }
  }

  private async disconnect(): Promise<void> {
    const browser = this.activeBrowser;
    this.activeBrowser = undefined;
    if (!browser) return;
    try {
      for (const context of browser.contexts()) {
        await context.close().catch(() => {});
      }
      await browser.close();
    } catch {
      // The browser can already be disconnected after a test failure or a remote refresh.
    }
  }

  private assertOpen(): void {
    if (this.closed) {
      throw new Error(`Remote session ${this.originalSessionId} is closed.`);
    }
  }
}

function browserTypeFor(playwright: PlaywrightApi, name: string): BrowserType {
  const normalized = name.replace(/^playwright-/, '').toLowerCase();
  if (normalized === 'firefox') return playwright.firefox;
  if (normalized === 'webkit' || normalized === 'safari') return playwright.webkit;
  return playwright.chromium;
}

function webSocketEndpoint(baseUrl: URL, sessionId: string): string {
  const url = new URL(baseUrl);
  url.pathname = `${url.pathname.replace(/\/+$/, '')}/${encodeURIComponent(sessionId)}`;
  return url.toString();
}

function endpoint(host: URL, ...segments: string[]): URL {
  const url = new URL(host.origin);
  url.pathname = `/${segments.map((segment) => encodeURIComponent(segment)).join('/')}`;
  return url;
}

function basicAuthorization(username: string, password: string): string {
  return `Basic ${Buffer.from(`${username}:${password}`, 'utf8').toString('base64')}`;
}

async function readJson(response: Response, label: string, host: string): Promise<RemoteResponse> {
  const text = (await response.text()).trim();
  if (!text) return {};
  try {
    return JSON.parse(text) as RemoteResponse;
  } catch {
    throw new Error(`${label} returned non-JSON (${response.status}) from ${host}: ${text.slice(0, 500)}`);
  }
}

function assertSuccessfulResponse(response: Response, body: RemoteResponse, label: string): void {
  const message = responseError(body);
  if (!response.ok || message) {
    throw new Error(`${label} failed (${response.status}): ${message || safeBody(body)}`);
  }
}

async function assertResponseOk(response: Response, label: string): Promise<void> {
  if (response.ok) return;
  const detail = (await response.text()).trim().slice(0, 500);
  throw new Error(`${label} failed (${response.status})${detail ? `: ${detail}` : ''}`);
}

function responseError(body: RemoteResponse): string | undefined {
  const value = objectValue(body.value);
  const error = stringValue(value.error) || stringValue(body.error);
  const message = stringValue(value.message) || stringValue(body.message);
  return error ? (message ? `${error}: ${message}` : error) : undefined;
}

function responseSessionId(body: RemoteResponse): string | undefined {
  return stringValue(body.sessionId) || stringValue(objectValue(body.value).sessionId);
}

function refreshResult(body: RemoteResponse, fallbackOriginalSessionId: string): RemoteRefreshResult {
  const value = objectValue(body.value);
  const sessionId = stringValue(value.sessionId);
  if (!sessionId) {
    throw new Error(`Remote refresh returned no sessionId: ${safeBody(body)}`);
  }
  return {
    sessionId,
    originalSessionId: stringValue(value.originalSessionId) || fallbackOriginalSessionId,
    browserType: stringValue(value.browserType),
    generation: numberValue(value.generation),
  };
}

function objectValue(value: unknown): RemoteResponse {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as RemoteResponse) : {};
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function safeBody(body: RemoteResponse): string {
  return JSON.stringify(body).slice(0, 1000);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
