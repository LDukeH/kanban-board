import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Does not import vite.config.ts so tailwind/babel/react plugins never run in tests; helpers, stores and API layers run in plain Node (no jsdom).
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
    // Live-API tests (test/live/**) hit the real Go backend and are opt-in only — see vitest.live.config.ts.
    exclude: ["test/live/**"],
    setupFiles: ["test/setup.ts"],
  },
});