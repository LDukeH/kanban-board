import { defineConfig } from "vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    babel({ presets: [reactCompilerPreset()] }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            // Framework core: changes least, cached longest.
            {
              name: "react",
              test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/,
              priority: 100,
            },
            {
              name: "router",
              test: /node_modules[\\/](react-router|@remix-run)[\\/]/,
              priority: 90,
            },
            {
              name: "query",
              test: /node_modules[\\/]@tanstack[\\/]/,
              priority: 85,
            },
            // Feature libraries tied to specific pages.
            {
              name: "dnd",
              test: /node_modules[\\/]@dnd-kit[\\/]/,
              priority: 80,
            },
            {
              name: "base-ui",
              test: /node_modules[\\/]@base-ui[\\/]/,
              priority: 75,
            },
            {
              name: "motion",
              test: /node_modules[\\/]motion(-dom|-utils)?[\\/]/,
              priority: 70,
            },
            {
              name: "forms",
              test: /node_modules[\\/](zod|react-hook-form|@hookform)[\\/]/,
              priority: 65,
            },
            {
              name: "icons",
              test: /node_modules[\\/]lucide-react[\\/]/,
              priority: 60,
            },
            // Everything else from node_modules (axios, ...).
            {
              name: "vendor",
              test: /node_modules[\\/]/,
              priority: 10,
            },
          ],
        },
      },
    },
  },
});
