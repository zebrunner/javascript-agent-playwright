// Not compiled by tsc: this package's tsconfig targets CommonJS, which does
// not support top-level await, so this file is hand-written ESM and copied
// as-is into build/javascript-agent-playwright/preload.mjs rather than
// transpiled. It is not part of the `include` glob tsc uses (tsc only
// processes .ts/.tsx by default), so it is safe to keep alongside the rest
// of the sources without breaking `npm run build`.
//
// Rerun fallback for Playwright 1.58-1.61. From 1.62 onwards the reporter's
// own preprocess() hook scopes a rerun with no user setup at all, and this
// file exits immediately; see ZebrunnerReporter.ts#preprocess.
//
// Preloaded via `NODE_OPTIONS="--import <this file>"` ahead of Playwright's
// own CLI startup. Node guarantees an --import module (including any
// top-level await inside it) fully resolves before the main entry script's
// code runs, so mutating process.argv here happens before Playwright's own
// program.js ever parses it. On those older versions that is the only place
// it can happen: Playwright builds its dispatch plan (createPhasesTask)
// before reporter.onBegin (createReportBeginTask) ever runs, so no amount of
// Suite mutation from inside a reporter can change which tests execute.
import { writeFile, mkdtemp, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const RUN_CONTEXT_RAW = process.env.REPORTING_RUN_CONTEXT;
const ALREADY_APPLIED = process.env.REPORTING_PRELOAD_APPLIED;

// Playwright's own hook supersedes this file; running both would exchange the run context twice.
function supportsPreprocessHook() {
  try {
    const require = createRequire(import.meta.url);
    const { version } = require("@playwright/test/package.json");
    const [major, minor] = version.split(".").map(Number);
    return major > 1 || (major === 1 && minor >= 62);
  } catch {
    return false;
  }
}

async function resolveRerunTestList(runContextRaw) {
  // No default hostname: an unset one must fail rather than send credentials and a run context to
  // whatever host happens to answer. Reporter options from playwright.config.ts are not visible
  // here - this file runs before Playwright loads the config - so the environment is the only source.
  const hostname = process.env.REPORTING_SERVER_HOSTNAME;
  if (!hostname) {
    throw new Error("REPORTING_SERVER_HOSTNAME is not set");
  }
  const accessToken = process.env.REPORTING_SERVER_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error("REPORTING_SERVER_ACCESS_TOKEN is not set");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const authResponse = await fetch(new URL("/api/iam/v1/auth/refresh", hostname), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: accessToken }),
      signal: controller.signal,
    });
    if (!authResponse.ok) {
      throw new Error(`auth/refresh failed: HTTP ${authResponse.status}`);
    }
    const { authToken } = await authResponse.json();

    // The run context is a payload Zebrunner issued; it goes back as the opaque string it is.
    const exchangeResponse = await fetch(new URL("/api/reporting/v1/run-context-exchanges", hostname), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      body: runContextRaw,
      signal: controller.signal,
    });
    if (!exchangeResponse.ok) {
      throw new Error(`run-context-exchanges failed: HTTP ${exchangeResponse.status}`);
    }
    const exchanged = await exchangeResponse.json();

    if (!exchanged.runAllowed) {
      throw new Error(`Zebrunner Reporting is not allowed. Reason: ${exchanged.reason}`);
    }
    if (exchanged.mode === "NEW" || !exchanged.runOnlySpecificTests) {
      return null;
    }

    // A --test-list line is "[<project>] › <file> › <title-path...>": the project prefix is
    // optional, the file must equal the spec path relative to the config's rootDir, and the title
    // path is matched as a prefix. That is the identity the agent stores as correlation data,
    // except for the root the spec is relative to: correlation data is relative to the working
    // directory, while rootDir is the common ancestor of the configured testDirs, which is usually
    // deeper. The config is not loaded yet, so every suffix of the spec is offered and Playwright
    // keeps the one that resolves. Two same-named specs at different depths could in principle both
    // match; preprocess() on Playwright 1.62+ compares the identity directly and cannot.
    const lines = new Set();
    for (const test of exchanged.testsToRun ?? []) {
      const correlationData = parseCorrelationData(test.correlationData);
      if (!correlationData) {
        continue;
      }
      const { projectName, spec, titlePath } = correlationData;
      // A title carrying a delimiter would split into the wrong segments and silently drop the
      // test from the run. Playwright 1.62's preprocess() has no such limitation.
      if ([spec, ...titlePath].some((segment) => segment.includes("›") || segment.includes(">"))) {
        throw new Error(
          `cannot scope the test "${[spec, ...titlePath].join(" › ")}": its name contains a test-list delimiter. ` +
            "Upgrade to Playwright 1.62 or later, where scoping does not go through a test list.",
        );
      }
      const specSegments = spec.split("/");
      for (let index = 0; index < specSegments.length; index += 1) {
        const fileAndTitle = [specSegments.slice(index).join("/"), ...titlePath].join(" › ");
        lines.add(projectName ? `[${projectName}] › ${fileAndTitle}` : fileAndTitle);
      }
    }
    if (lines.size === 0) {
      throw new Error(
        "none of the tests to rerun carries identity correlation data - the original launch was " +
          "reported by an agent version that did not write it",
      );
    }

    const directory = await mkdtemp(join(tmpdir(), "zebrunner-rerun-"));
    const testListPath = join(directory, "test-list.txt");
    await writeFile(testListPath, [...lines].join("\n") + "\n", "utf-8");
    process.once("exit", () => {
      rm(directory, { recursive: true, force: true }).catch(() => undefined);
    });
    return testListPath;
  } finally {
    clearTimeout(timeout);
  }
}

function parseCorrelationData(value) {
  if (!value) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed.spec !== "string" || !Array.isArray(parsed.titlePath)) {
      return undefined;
    }
    return {
      projectName: typeof parsed.projectName === "string" ? parsed.projectName : "",
      spec: parsed.spec,
      titlePath: parsed.titlePath.map(String),
    };
  } catch {
    return undefined;
  }
}

if (RUN_CONTEXT_RAW && !ALREADY_APPLIED && !supportsPreprocessHook()) {
  // Guards against re-running this exchange in Playwright's own worker
  // subprocesses: NODE_OPTIONS is inherited by every child Node process,
  // including per-test workers Playwright forks, and this flag (once set
  // here) is inherited by them too since they fork after this line runs.
  process.env.REPORTING_PRELOAD_APPLIED = "1";
  try {
    const testListPath = await resolveRerunTestList(RUN_CONTEXT_RAW);
    if (testListPath) {
      process.argv.push("--test-list", testListPath);
    }
  } catch (error) {
    // Fail closed: a rerun that quietly runs the whole suite overwrites results by design.
    console.error(`[zebrunner-preload] rerun scoping failed - ${error.message}`);
    process.exit(1);
  }
}
