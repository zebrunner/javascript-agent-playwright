# Session fixture (local and remote)

The fixture provides the standard Playwright `page` and `context`. It selects a
local or a remote browser for each worker, so one test and one config run in
both modes.

## Add the fixture

```ts
import { expect, test } from '@zebrunner/javascript-agent-playwright/session-fixture';

test('opens the application', async ({ page }) => {
  await page.goto('https://example.com');
  await expect(page).toHaveTitle(/Example/);
});
```

Type the config with `SessionTestOptions` to get `sessionOptions` in `use`:

```ts
import { defineConfig } from '@playwright/test';
import type { SessionTestOptions } from '@zebrunner/javascript-agent-playwright/session-fixture';

export default defineConfig<SessionTestOptions>({
  use: { browserName: 'chromium', headless: false },
});
```

## Select local or remote

- In a Zebrunner launch, use the normal test command. The launch supplies the
  host and the capabilities.
- Outside a launch, set an authenticated host:
  ```bash
  REMOTE_HOST_URL=https://user:password@engine.example.com/wd/hub npx playwright test
  ```
- Force the mode with `REMOTE_SESSION_ENABLED=true` or `false` (or
  `sessionOptions.remoteEnabled`). With no host and no flag, the run is local.

## Behavior in both modes

- Context. The fixture builds the context and forwards the standard `use.*`
  options (`userAgent`, `locale`, `timezoneId`, `geolocation`, `permissions`,
  `colorScheme`, `deviceScaleFactor`, `ignoreHTTPSErrors`, `httpCredentials`,
  `extraHTTPHeaders`, `offline`, `storageState`, `baseURL`, `proxy`,
  `serviceWorkers`, `isMobile`, `hasTouch`, `javaScriptEnabled`,
  `acceptDownloads`, `bypassCSP`, `contextOptions`). It sets `viewport` and
  `recordVideo` itself.
- Browser. `browserName` selects the engine in both modes. Chrome and Edge map
  to `chromium`. Safari maps to `webkit`.
- Video. A remote run uses the grid server-side recording. A local run records
  `use.video`, and the reporter uploads it.
- Viewport. A local run uses `use.viewport`. A remote run uses the session
  viewport from `screenResolution`. To force a viewport in both modes, build the
  context yourself: `sessionBrowser.newContext({ viewport })`.
- Reporting. The reporter shows the real browser and platform, and links the
  remote session id for the video and the VNC view.

## Session lifecycle

By default, each test creates its own remote session (`POST /session` before,
`DELETE /session` after). Set `REMOTE_SESSION_REUSE=true` (or
`sessionOptions.reuseSession: true`) to reuse one session per worker and refresh the
browser between tests.

## Fixtures

| Fixture | Purpose |
| --- | --- |
| `page` / `context` | Standard Playwright page and context in the selected browser |
| `sessionBrowser` | The `Browser` for the current test. Use it instead of `browser`. |
| `remoteSession` | Remote session IDs, clipboard, and downloads. Remote only; it throws locally. |
| `sessionOptions` | Options for `test.use()` or project `use` |

`remoteSession` clipboard and downloads:

```ts
await remoteSession.setClipboard('text');
expect(await remoteSession.getClipboard()).toBe('text');

const [name] = await remoteSession.listDownloads();
const res = await remoteSession.fetchDownload(name);
await test.info().attach(name, { body: Buffer.from(await res.arrayBuffer()) });
await remoteSession.deleteDownload(name);
```

## Configuration reference

Precedence, highest first: code `sessionOptions`, then `ZEBRUNNER_CAPABILITIES`
(the launch JSON), then the environment variable, then Playwright options and
defaults. Set an override only when you need it. If you set `playwrightVersion`,
it must match the installed `@playwright/test`.

Naming: the code option and the create-request key use the short camelCase name
(`cpu`). The environment variable groups the value under a prefix: `SESSION_*`
for dual-mode, `REMOTE_SESSION_*` for remote-only, plus `BROWSER` for a
`zebrunner:options` value (for example `REMOTE_SESSION_BROWSER_CPU`).

### Connection and mode

| Value | Mode | Code option | Environment variable | Default |
| --- | --- | --- | --- | --- |
| Host | Remote | `sessionOptions.remoteHostUrl` | `ZEBRUNNER_HUB_URL`, then `REMOTE_HOST_URL` | none (required for remote) |
| Mode | Both | `sessionOptions.remoteEnabled` | `REMOTE_SESSION_ENABLED` | remote when a host is set |
| Reuse | Remote | `sessionOptions.reuseSession` | `REMOTE_SESSION_REUSE` | `false` |
| Launch capabilities | Remote | none | `ZEBRUNNER_CAPABILITIES` (JSON) | none |

The host URL carries the credentials and can include `/wd/hub` or the host only.

### Capabilities

Set these in `sessionOptions.capabilities`. Any other top-level key passes
through unchanged.

| Capability | Mode | Environment variable | Default |
| --- | --- | --- | --- |
| `browserName` | Both | `SESSION_BROWSER_NAME` | the Playwright `browserName`, else `chromium` |
| `platformName` | Remote | none | `playwright` |
| `headless` | Both | none (use `use.headless`) | the Playwright `headless`, else `false` |
| `playwrightVersion` (or `browserVersion`) | Remote | `REMOTE_SESSION_PLAYWRIGHT_VERSION` | the installed `@playwright/test` version |

`headless` applies to a remote launch. A local launch reads `use.headless` (or
the `--headed` flag). Set `headless: true` for a local container run with no
display.

### `zebrunner:options`

Remote only. Set each under
`sessionOptions.capabilities['zebrunner:options']`. The fixture always sends the
first group with a default, and sends the rest only when you set them.

| Option | Environment variable | Default |
| --- | --- | --- |
| `enableVideo` | `REMOTE_SESSION_BROWSER_ENABLE_VIDEO` | `true` |
| `enableVNC` | `REMOTE_SESSION_BROWSER_ENABLE_VNC` | `true` |
| `enableLog` | `REMOTE_SESSION_BROWSER_ENABLE_LOG` | `true` |
| `enableDebug` | `REMOTE_SESSION_BROWSER_ENABLE_DEBUG` | `false` |
| `screenResolution` | `REMOTE_SESSION_BROWSER_SCREEN_RESOLUTION` | `1920x1080x24` |
| `idleTimeout` | `REMOTE_SESSION_IDLE_TIMEOUT` | `300` (seconds) |
| `cpu` | `REMOTE_SESSION_BROWSER_CPU` | the instance type |
| `memory` | `REMOTE_SESSION_BROWSER_MEMORY` | the instance type |
| `maxTimeout` | `REMOTE_SESSION_MAX_TIMEOUT` | the engine |
| `videoScreenSize` | `REMOTE_SESSION_BROWSER_VIDEO_SCREEN_SIZE` | the engine |
| `frameRate` | `REMOTE_SESSION_BROWSER_FRAME_RATE` | the engine |
| `timeZone` | `REMOTE_SESSION_BROWSER_TIME_ZONE` | the engine |

`cpu` and `memory` use the instance-type unit: 1 vCPU is 1024. `idleTimeout`
also reads the top-level `zebrunner:idleTimeout`. Any other key, such as
`videoCodec`, passes through when you set it. In a launch Custom capabilities
field, use `zebrunner:cpu=2064;zebrunner:memory=2064`.

### Timeouts

Set each in `sessionOptions` (for example `sessionOptions.createTimeoutMs`) or
with the environment variable. All values are in milliseconds.

| Value | Mode | Environment variable | Default |
| --- | --- | --- | --- |
| `createTimeoutMs` | Remote | `REMOTE_SESSION_CREATE_TIMEOUT_MS` | `600000` (`POST /session`) |
| `connectTimeoutMs` | Remote | `REMOTE_SESSION_CONNECT_TIMEOUT_MS` | `120000` (WebSocket connect) |
| `refreshTimeoutMs` | Remote | `REMOTE_SESSION_REFRESH_TIMEOUT_MS` | `150000` (refresh) |
| `deleteTimeoutMs` | Remote | `REMOTE_SESSION_DELETE_TIMEOUT_MS` | `30000` (`DELETE /session`) |
| Worker fixture budget | Both | `SESSION_FIXTURE_TIMEOUT_MS` | `780000` |

Keep each per-operation timeout below `SESSION_FIXTURE_TIMEOUT_MS`.
