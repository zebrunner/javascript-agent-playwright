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
import type { RemoteTestOptions } from '@zebrunner/javascript-agent-playwright/remote';

export default defineConfig<RemoteTestOptions>({
  use: {
    browserName: 'chromium',
    headless: false,
  },
});
```

A Zebrunner launch supplies the remote connection and session capabilities. You do not need to add `remoteOptions` unless you want to override some capabilities.

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

## Override remote capabilities

Usually, Zebrunner supplies the remote capabilities. Use
`remoteOptions.capabilities` only when you must override them.

```ts
import { defineConfig } from '@playwright/test';
import type { RemoteTestOptions } from '@zebrunner/javascript-agent-playwright/remote';

export default defineConfig<RemoteTestOptions>({
  use: {
    browserName: 'chromium',
    remoteOptions: {
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

1. Code options. These are `remoteOptions.capabilities`, `remoteOptions.host`,
   and the `remoteOptions` timeouts. Set them in a project `use` or in `test.use`.
2. `ZEBRUNNER_CAPABILITIES`. This is the JSON capabilities that a Zebrunner launch
   injects.
3. `REMOTE_*` environment variables. Examples are `REMOTE_PLAYWRIGHT_BROWSER_NAME`,
   `REMOTE_PLAYWRIGHT_HEADLESS`, and the `REMOTE_BROWSER_*` values.
4. Playwright options and built-in defaults. Examples are `browserName`,
   `headless`, and the installed `@playwright/test` version.

A capability always wins over the matching environment variable. A code
capability wins over a launch capability.

Two values follow a separate order:

- Host. The order is `remoteOptions.host`, then `ZEBRUNNER_HUB_URL`, then
  `REMOTE_HOST`. The host is not a capability.
- Timeouts. The order is the `remoteOptions` timeout, then the
  `REMOTE_*_TIMEOUT_MS` variable, then the default.

The `zebrunner:options` block merges in the same order. A code option overrides a
launch option. A launch option overrides the `REMOTE_BROWSER_*` default.

`playwrightVersion` also reads from `browserVersion`. A code or launch
`browserVersion` sets `playwrightVersion` when no explicit `playwrightVersion` is
set. The resolved version must match the installed `@playwright/test` version, or
the fixture throws.

## Select the mode explicitly

Use `remoteOptions.remote` for one project:

```ts
export default defineConfig<RemoteTestOptions>({
  use: {
    remoteOptions: {
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

Set `REMOTE_REFRESH=true` (or `remoteOptions.refresh: true`) to reuse one remote
session for a whole worker. In this mode, each worker creates one remote session
before its first test. Before each later test, the fixture refreshes the browser
in the same remote session. After the worker finishes its last test, the fixture
closes the browser and deletes the remote session.

```bash
REMOTE_REFRESH=true npx playwright test
```

```ts
export default defineConfig<RemoteTestOptions>({
  use: {
    remoteOptions: {
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
| `remoteBrowser` | Local or remote Playwright `Browser` for the current test  |
| `remoteSession` | Remote session IDs, clipboard, and download operations     |
| `remoteOptions` | Options for `test.use()` or project `use`                  |

Use `remoteBrowser` when a test needs the browser object. Do not request the
standard `browser` fixture.

`remoteSession` is available only in remote mode.

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
| `remoteOptions.host` / `ZEBRUNNER_HUB_URL` / `REMOTE_HOST` | Remote host with the credentials in the URL. The URL can include `/wd/hub` or the host only. | none (required for a remote run) |
| `remoteOptions.remote` / `REMOTE` | Force remote (`true`) or local (`false`). | remote when a host is set |
| `remoteOptions.refresh` / `REMOTE_REFRESH` | Reuse one session per worker and refresh it between tests. | `false` |
| `ZEBRUNNER_CAPABILITIES` | JSON capabilities that a Zebrunner launch injects. | none |

### Capabilities

These go in the create request. Set them in `remoteOptions.capabilities`.

| Capability | Environment variable | Default |
| --- | --- | --- |
| `browserName` | `REMOTE_PLAYWRIGHT_BROWSER_NAME` | the Playwright `browserName`, else `chromium` |
| `platformName` | none | `playwright` |
| `headless` | `REMOTE_PLAYWRIGHT_HEADLESS` | the Playwright `headless`, else `false` |
| `playwrightVersion` (or `browserVersion`) | `REMOTE_PLAYWRIGHT_VERSION` | the installed `@playwright/test` version; must match it |
| `zebrunner:idleTimeout` | `REMOTE_IDLE_TIMEOUT` | `300` (seconds) |

Any other top-level capability passes through to the create request unchanged.

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

Set these in `remoteOptions` or with the environment variable. All values are in
milliseconds.

| Option | Environment variable | Default |
| --- | --- | --- |
| `createTimeoutMs` | `REMOTE_SESSION_CREATE_TIMEOUT_MS` | `600000` (`POST /session`) |
| `connectTimeoutMs` | `REMOTE_PLAYWRIGHT_CONNECT_TIMEOUT_MS` | `120000` (WebSocket connect) |
| `refreshTimeoutMs` | `REMOTE_PLAYWRIGHT_REFRESH_TIMEOUT_MS` | `150000` (refresh) |
| `deleteTimeoutMs` | `REMOTE_SESSION_DELETE_TIMEOUT_MS` | `30000` (`DELETE /session`) |
| none | `REMOTE_SESSION_FIXTURE_TIMEOUT_MS` | `780000` (worker fixture budget for create and refresh) |

Keep each per-operation timeout below `REMOTE_SESSION_FIXTURE_TIMEOUT_MS`, which
bounds the worker fixture.
