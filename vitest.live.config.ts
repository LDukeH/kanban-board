import { defineConfig } from "vitest/config";
import baseConfig from "./vitest.config";

// Live-API integration suite (opt-in). Runs the production `src/lib/api/`
// client against the real Go Kanban API instead of the fake transport adapter.
// Enable with `npm run test:api` (needs the backend up; see README/dev notes),
// or point it elsewhere with `LIVE_API_BASE_URL`.
//
// Deliberately separate from the deterministic offline suite: this suite owns
// real sessions (cookie jar), real authorization checks and real server state,
// so it is serialized and skipped by the default `npm run test` include/exclude.
//
// Reporting: keeps the human-readable `default` reporter on the terminal AND
// writes machine-readable results to files for later inspection/CI:
//   - test-results/live-api.json      (vitest `json` reporter)
//   - test-results/live-api-junit.xml (vitest `junit` reporter)
// Override the locations with `--outputFile.json=...` / `--outputFile.junit=...`.
export default defineConfig({
  ...baseConfig,
  test: {
    ...baseConfig.test,
    include: ["test/live/**/*.test.ts"],
    // The offline suite excludes test/live; the live suite must undo that.
    exclude: [],
    // Only one test file at a time: the shared axios client holds exactly one
    // session (cookie) at a time.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 20_000,
    reporters: ["default", "json", "junit"],
    outputFile: {
      json: "./test-results/live-api.json",
      junit: "./test-results/live-api-junit.xml",
    },
  },
});