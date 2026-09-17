import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Standalone test config: intentionally does NOT import vite.config.ts so the
// tailwind/babel/react plugins never run in the test environment. Pure helpers,
// stores and API layers all run in a Node environment (no jsdom) per the
// automated-regression-coverage skill.
const configDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(configDir, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    // Live-API integration tests (test/live/**) hit the real Go backend and are
    // opt-in only — see vitest.live.config.ts and `npm run test:api`.
    exclude: ["test/live/**"],
    setupFiles: ["test/setup.ts"],
  },
});