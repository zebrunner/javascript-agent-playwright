# Local and remote Playwright fixture

The fixture supplies the standard Playwright `page` and `context` fixtures. It
selects a local or remote browser for each worker.

## Add the fixture

Import `test` and `expect` from the remote package path:

```ts
import { expect, test } from '@zebrunner/javascript-agent-playwright/remote';

test('opens the application', async ({ page }) => {
  await page.goto('https://example.com');
  await expect(page).toHaveTitle(/Example/);
});
```

You can use the same test code for local and remote runs.

## Configure Playwright

Use the normal Playwright project options:

```ts
import { defineConfig } from '@playwright/test';
import type { SessionTestOptions } from '@zebrunner/javascript-agent-playwright/remote';

export default defineConfig<SessionTestOptions>({
  use: {
    browserName: 'chromium',
    headless: false,
  },
});
```

A Zebrunner launch supplies the remote connection and session capabilities. You do not need to add `sessionOptions` unless you want to override some capabilities.

## Run locally

Run Playwright when REMOTE_HOST is not set:

```bash
npx playwright test
```

To use a local browser inside a Zebrunner launch, set `REMOTE=false`:

```bash
REMOTE=false npx playwright test
```

## Run remotely

In a Zebrunner launch, use the normal test command. The launcher supplies the
required configuration.

You can set session options in the launch Custom capabilities field. Use the
same format as other Zebrunner launches:

```text
zebrunner:cpu=2064;zebrunner:memory=2064
```

The launcher applies these custom capabilities to each remote session.

Outside a Zebrunner launch, set an authenticated `REMOTE_HOST`:

```bash
REMOTE_HOST=https://user:password@engine.example.com/wd/hub npx playwright test
```

## Local and remote parity

You write one test and one config. The `page` and `context` fixtures apply the
same Playwright options in both modes. A `REMOTE=true` run and a `REMOTE=false`
run behave the same for the standard cases.

### Context options

The fixture builds the context, so it forwards the standard `use.*` context
options in both modes: `userAgent`, `locale`, `timezoneId`, `geolocation`,
`permissions`, `colorScheme`, `deviceScaleFactor`, `ignoreHTTPSErrors`,
`httpCredentials`, `extraHTTPHeaders`, `offline`, `storageState`, `baseURL`,
`proxy`, `serviceWorkers`, `isMobile`, `hasTouch`, `javaScriptEnabled`,
`acceptDownloads`, `bypassCSP`, and the raw `contextOptions` object.

The fixture sets two options itself, and these win over your values:

- `viewport`. A remote session uses its own session viewport. A local run uses
  your `viewport`.
- `recordVideo`. A local run wires this for video. See the next part.

A test that builds its own context with `sessionBrowser.newContext(...)` records
video too on a local run. The fixture wraps the browser and attaches the video.

### Video

- Remote. Zebrunner shows the grid server-side session recording. The fixture
  does not record a second Playwright video.
- Local. There is no grid recording, so the fixture honors `use.video`. It
  records the Playwright video and attaches the file. The reporter uploads it.

### Browser type

`capabilities.browserName` selects the engine in both modes. A remote run
requests that engine from the grid. A local run launches the matching Playwright
engine (`chromium`, `firefox`, or `webkit`). Chrome and Edge map to `chromium`.
Safari maps to `webkit`. When you set no `browserName`, the fixture uses the
Playwright `browserName`.

### Reported browser and platform

The reporter shows the real browser and platform for each mode. A remote run
reports the grid session browser and links the session id for the video and the
VNC view. A local run reports the local browser name and version and the host
operating system.

## Override remote capabilities

Usually, Zebrunner supplies the remote capabilities. Use
`sessionOptions.capabilities` only when you must override them.

```ts
import { defineConfig } from '@playwright/test';
import type { SessionTestOptions } from '@zebrunner/javascript-agent-playwright/remote';

export default defineConfig<SessionTestOptions>({
  use: {
    browserName: 'chromium',
    sessionOptions: {
      capabilities: {
        playwrightVersion: '1.58.2',
        'zebrunner:options': {
          enableVideo: true,
          enableVNC: true,
          enableLog: true,
          enableDebug: false,
          screenResolution: '1920x1080x24',
          videoScreenSize: '1920x1080',
          videoCodec: 'libx264',
          frameRate: 24,
          idleTimeout: 300,
          maxTimeout: 3600,
          cpu: 2064,
          memory: 2064,
          timeZone: 'Europe/Warsaw',
        },
      },
    },
  },
});
```

Set only the values that you must override. If you set `playwrightVersion`, it
must match the installed `@playwright/test` version.

## Configuration precedence

The fixture resolves each value from four sources. A higher source wins.

1. Code options. These are `sessionOptions.capabilities`, `sessionOptions.host`,
   and the `sessionOptions` timeouts. Set them in a project `use` or in `test.use`.
2. `ZEBRUNNER_CAPABILITIES`. This is the JSON capabilities that a Zebrunner launch
   injects.
3. Environment variables. The dual-mode `SESSION_BROWSER_NAME` selects the engine
   for a local or a remote run. The `REMOTE_*` variables apply to a remote session
   only. Examples are `REMOTE_PLAYWRIGHT_HEADLESS` and the `REMOTE_BROWSER_*` values.
4. Playwright options and built-in defaults. Examples are `browserName`,
   `headless`, and the installed `@playwright/test` version.

A capability always wins over the matching environment variable. A code
capability wins over a launch capability.

Two values follow a separate order:

- Host. The order is `sessionOptions.host`, then `ZEBRUNNER_HUB_URL`, then
  `REMOTE_HOST`. The host is not a capability.
- Timeouts. The order is the `sessionOptions` timeout, then the
  `REMOTE_*_TIMEOUT_MS` variable, then the default.

The `zebrunner:options` block merges in the same order. A code option overrides a
launch option. A launch option overrides the `REMOTE_BROWSER_*` default.

`playwrightVersion` also reads from `browserVersion`. A code or launch
`browserVersion` sets `playwrightVersion` when no explicit `playwrightVersion` is
set. The resolved version must match the installed `@playwright/test` version, or
the fixture throws.

## Viewport

The viewport resolves differently from the other context options.

- A local run (`REMOTE=false`) uses the Playwright `use.viewport`.
- A remote run replaces `use.viewport` with the session viewport. The session
  viewport comes from the `zebrunner:options.screenResolution` capability
  (default `1920x1080`). This keeps the grid screen, the VNC view, the video, and
  the context viewport at one size, so `use.viewport` does not desync them.

To force an exact viewport on both a local and a remote run, create the context
yourself with `sessionBrowser.newContext({ viewport })`. That call does not pass
through the fixture, so the session viewport does not replace it.

```ts
const context = await sessionBrowser.newContext({ viewport: { width: 800, height: 600 } });
```

To change the remote screen (and therefore the remote viewport), set
`screenResolution` through a capability:

```ts
use: {
  sessionOptions: {
    capabilities: { 'zebrunner:options': { screenResolution: '1280x720x24' } },
  },
},
```

You can also set `REMOTE_BROWSER_SCREEN_RESOLUTION` or inject
`ZEBRUNNER_CAPABILITIES`. Note: headed Chromium uses no fixed viewport -- the
window maximizes to the screen, so the viewport still equals `screenResolution`.

## Select the mode explicitly

Use `sessionOptions.remote` for one project:

```ts
export default defineConfig<SessionTestOptions>({
  use: {
    sessionOptions: {
      remote: false,
    },
  },
});
```

Use `REMOTE=true` or `REMOTE=false` to select the mode for the process. A
configured remote host selects remote mode when you do not set either option.

## Remote session lifecycle

By default, each test creates its own remote session. The fixture sends
`POST /session` before the test, and `DELETE /session` after the test. A parallel
run creates one remote session for each running test.

### Reuse one session per worker

Set `REMOTE_REFRESH=true` (or `sessionOptions.refresh: true`) to reuse one remote
session for a whole worker. In this mode, each worker creates one remote session
before its first test. Before each later test, the fixture refreshes the browser
in the same remote session. After the worker finishes its last test, the fixture
closes the browser and deletes the remote session.

```bash
REMOTE_REFRESH=true npx playwright test
```

```ts
export default defineConfig<SessionTestOptions>({
  use: {
    sessionOptions: {
      refresh: true,
    },
  },
});
```

## Use the fixtures

| Fixture         | Purpose                                                    |
| --------------- | ---------------------------------------------------------- |
| `page`          | Standard Playwright page in the local or remote browser    |
| `context`       | Standard Playwright context in the local or remote browser |
| `sessionBrowser` | Local or remote Playwright `Browser` for the current test  |
| `remoteSession` | Remote session IDs, clipboard, and download operations     |
| `sessionOptions` | Options for `test.use()` or project `use`                  |

Use `sessionBrowser` when a test needs the browser object. Do not request the
standard `browser` fixture.

`sessionBrowser` resolves in both modes. In a local run, it is the local browser.
`remoteSession` is available only in remote mode. It stops with an error in a
local run.

## Use the clipboard and downloads

Use `remoteSession` to read or write the remote clipboard:

```ts
test('uses the remote clipboard', async ({ remoteSession }) => {
  await remoteSession.setClipboard('clipboard text');
  expect(await remoteSession.getClipboard()).toBe('clipboard text');
});
```

After the application downloads a file, you can list and fetch the remote
downloads:

```ts
test('gets a remote download', async ({ remoteSession }) => {
  const [name] = await remoteSession.listDownloads();
  expect(name).toBeTruthy();

  const response = await remoteSession.fetchDownload(name);
  const body = Buffer.from(await response.arrayBuffer());
  await test.info().attach(name, { body });

  await remoteSession.deleteDownload(name);
});
```

Use `remoteSession.downloadUrl(name)` when you need the direct file URL. These
operations use the active browser session for the current test.

## Configuration reference

Each value resolves by the precedence above: code option, then
`ZEBRUNNER_CAPABILITIES`, then the environment variable, then the default.

### Connection and mode

| Option / variable | Purpose | Default |
| --- | --- | --- |
| `sessionOptions.host` / `ZEBRUNNER_HUB_URL` / `REMOTE_HOST` | Remote host with the credentials in the URL. The URL can include `/wd/hub` or the host only. | none (required for a remote run) |
| `sessionOptions.remote` / `REMOTE` | Force remote (`true`) or local (`false`). | remote when a host is set |
| `sessionOptions.refresh` / `REMOTE_REFRESH` | Reuse one session per worker and refresh it between tests. | `false` |
| `ZEBRUNNER_CAPABILITIES` | JSON capabilities that a Zebrunner launch injects. | none |

### Capabilities

These go in the create request. Set them in `sessionOptions.capabilities`.

| Capability | Environment variable | Default |
| --- | --- | --- |
| `browserName` | `SESSION_BROWSER_NAME` (local and remote) | the Playwright `browserName`, else `chromium` |
| `platformName` | none | `playwright` |
| `headless` | `REMOTE_PLAYWRIGHT_HEADLESS` | the Playwright `headless`, else `false` |
| `playwrightVersion` (or `browserVersion`) | `REMOTE_PLAYWRIGHT_VERSION` | the installed `@playwright/test` version; must match it |
| `zebrunner:idleTimeout` | `REMOTE_IDLE_TIMEOUT` | `300` (seconds) |

Any other top-level capability passes through to the create request unchanged.

`browserName` applies in both modes. `headless` applies only to a remote launch.
A local launch reads the Playwright `headless` value (`use.headless`, the
`--headed` flag), not the capability. Set `headless` in `use` for a local run.
Set `headless: true` for a local run in a container with no display, or a headed
browser stops with "Missing X server or $DISPLAY".

### `zebrunner:options`

The fixture always sends these, with a default:

| Option | Environment variable | Default |
| --- | --- | --- |
| `enableVideo` | `REMOTE_BROWSER_ENABLE_VIDEO` | `true` |
| `enableVNC` | `REMOTE_BROWSER_ENABLE_VNC` | `true` |
| `enableLog` | `REMOTE_BROWSER_ENABLE_LOG` | `true` |
| `enableDebug` | `REMOTE_BROWSER_ENABLE_DEBUG` | `false` |
| `screenResolution` | `REMOTE_BROWSER_SCREEN_RESOLUTION` | `1920x1080x24` |
| `idleTimeout` | `REMOTE_IDLE_TIMEOUT` | `300` (seconds) |

The fixture sends these only when you set them. When you omit them, the engine
and the instance type decide the value:

| Option | Environment variable | Default |
| --- | --- | --- |
| `cpu` | `REMOTE_BROWSER_CPU` | the instance type |
| `memory` | `REMOTE_BROWSER_MEMORY` | the instance type |
| `maxTimeout` | `REMOTE_MAX_TIMEOUT` | the engine |
| `videoScreenSize` | `REMOTE_BROWSER_VIDEO_SCREEN_SIZE` | the engine |
| `frameRate` | `REMOTE_BROWSER_FRAME_RATE` | the engine |
| `timeZone` | `REMOTE_BROWSER_TIME_ZONE` | the engine |

`cpu` and `memory` use the same unit as the instance type: 1 vCPU is 1024. Any
other `zebrunner:options` key, such as `videoCodec`, passes through when you set
it.

### Timeouts

Set these in `sessionOptions` or with the environment variable. All values are in
milliseconds.

| Option | Environment variable | Default |
| --- | --- | --- |
| `createTimeoutMs` | `REMOTE_SESSION_CREATE_TIMEOUT_MS` | `600000` (`POST /session`) |
| `connectTimeoutMs` | `REMOTE_PLAYWRIGHT_CONNECT_TIMEOUT_MS` | `120000` (WebSocket connect) |
| `refreshTimeoutMs` | `REMOTE_PLAYWRIGHT_REFRESH_TIMEOUT_MS` | `150000` (refresh) |
| `deleteTimeoutMs` | `REMOTE_SESSION_DELETE_TIMEOUT_MS` | `30000` (`DELETE /session`) |
| none | `SESSION_FIXTURE_TIMEOUT_MS` | `780000` (worker fixture budget: local launch, or remote create and refresh) |

Keep each per-operation timeout below `SESSION_FIXTURE_TIMEOUT_MS`, which
bounds the worker fixture on both a local and a remote run.
