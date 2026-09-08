// Not compiled by tsc: this package's tsconfig targets CommonJS, which does
// not support top-level await, so this file is hand-written ESM and copied
// as-is into build/javascript-agent-playwright/preload.mjs rather than
// transpiled. It is not part of the `include` glob tsc uses (tsc only
// processes .ts/.tsx by default), so it is safe to keep alongside the rest
// of the sources without breaking `npm run build`.
//
// Preloaded via `NODE_OPTIONS="--import <this file>"` ahead of Playwright's
// own CLI startup. Node guarantees an --import module (including any
// top-level await inside it) fully resolves before the main entry script's
// code runs, so mutating process.argv here happens before Playwright's own
// program.js ever parses it. This is what the Reporter API (onBegin and
// later) cannot do: Playwright builds its dispatch plan (createPhasesTask)
// before reporter.onBegin (createReportBeginTask) ever runs, so no amount of
// Suite mutation from inside a reporter can change which tests execute —
// only influencing argv before Playwright's CLI parses it can. See the
// comment in ZebrunnerReporter.ts#rerunResolver for why the previous
// approach (recursiveTestsTraversal mutating the Suite) never worked and
// was actively harmful.
import { writeFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const RUN_CONTEXT_RAW = process.env.REPORTING_RUN_CONTEXT;
const ALREADY_APPLIED = process.env.ZEBRUNNER_PRELOAD_APPLIED;

async function resolveRerunTestList(runContextRaw) {
  const hostname = process.env.REPORTING_SERVER_HOSTNAME || "https://api.zebrunner.com/";
  const accessToken =
    process.env.ZEBRUNNER_REPORTING_SERVER_ACCESS_TOKEN || process.env.REPORTING_SERVER_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error("REPORTING_RUN_CONTEXT is set but no reporting access token is available");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const launchContext = JSON.parse(runContextRaw);

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

    const exchangeResponse = await fetch(new URL("/api/reporting/v1/run-context-exchanges", hostname), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      body: JSON.stringify(launchContext),
      signal: controller.signal,
    });
    if (!exchangeResponse.ok) {
      throw new Error(`run-context-exchanges failed: HTTP ${exchangeResponse.status}`);
    }
    const exchanged = await exchangeResponse.json();

    if (!exchanged.runAllowed) {
      throw new Error(`rerun not allowed - ${exchanged.reason}`);
    }
    if (exchanged.mode === "NEW" || !exchanged.runOnlySpecificTests) {
      return null;
    }

    // A Zebrunner test name is the reporter's identity joined by " > ":
    //   [<project> > ][<project> > ]<relative/file.spec.ts> > <suite...> > <title>
    // The leading project is ABSENT when Playwright has no named projects,
    // present once normally, and duplicated in some setups. Playwright's
    // --test-list line is "[<project>] › <file> › <title-path...>", where the
    // "[project]" prefix is OPTIONAL and matching is by exact file path +
    // title-path prefix.
    //
    // Rather than assume a fixed position for the project (which breaks for the
    // no-project and duplicated-project cases — the file gets mistaken for the
    // project and nothing matches: "No tests found"), locate the file segment
    // (the first token that looks like a test file) and treat everything before
    // it as the optional project prefix.
    const looksLikeTestFile = (segment) => /\.[cm]?[jt]sx?(:\d+(:\d+)?)?$/i.test(segment);
    const lines = new Set();
    for (const test of exchanged.testsToRun ?? []) {
      const segments = test.name
        .split(" > ")
        .map((segment) => segment.trim())
        .filter(Boolean);
      const fileIndex = segments.findIndex(looksLikeTestFile);
      // Need a file and at least one title segment after it to scope precisely.
      if (fileIndex === -1 || fileIndex === segments.length - 1) {
        continue;
      }
      const fileAndTitle = segments.slice(fileIndex).join(" › ");
      const project = fileIndex > 0 ? segments[fileIndex - 1] : undefined;
      lines.add(project ? `[${project}] › ${fileAndTitle}` : fileAndTitle);
    }
    if (lines.size === 0) {
      throw new Error("runOnlySpecificTests is true but no tests resolved");
    }

    const dir = await mkdtemp(join(tmpdir(), "zebrunner-rerun-"));
    const testListPath = join(dir, "test-list.txt");
    await writeFile(testListPath, [...lines].join("\n") + "\n", "utf-8");
    return testListPath;
  } finally {
    clearTimeout(timeout);
  }
}

if (RUN_CONTEXT_RAW && !ALREADY_APPLIED) {
  // Guards against re-running this exchange in Playwright's own worker
  // subprocesses: NODE_OPTIONS is inherited by every child Node process,
  // including per-test workers Playwright forks, and this flag (once set
  // here) is inherited by them too since they fork after this line runs.
  process.env.ZEBRUNNER_PRELOAD_APPLIED = "1";
  try {
    const testListPath = await resolveRerunTestList(RUN_CONTEXT_RAW);
    if (testListPath) {
      process.argv.push("--test-list", testListPath);
    }
  } catch (error) {
    console.warn("[zebrunner-preload] rerun scoping unavailable, running full suite instead:", error.message);
  }
}
