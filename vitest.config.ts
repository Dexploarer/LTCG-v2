import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Convex component packages use a custom export condition to point at source
    // (since `dist/` is not committed). Enable it for Vitest runs.
    conditions: ["@convex-dev/component-source", "import", "default"],
    alias: {
      "@": path.resolve(__dirname, "apps/web/src"),
      "@convex-generated-api": path.resolve(__dirname, "convex/_generated/api.js"),
      // These workspace packages publish compiled output under `dist/`, but we don't
      // commit build artifacts. Alias tests to the source entrypoints.
      "@lunchtable-tcg/cards": path.resolve(
        __dirname,
        "packages/lunchtable-tcg-cards/src/client/index.ts",
      ),
      "@lunchtable-tcg/match": path.resolve(
        __dirname,
        "packages/lunchtable-tcg-match/src/client/index.ts",
      ),
      "@lunchtable-tcg/story": path.resolve(
        __dirname,
        "packages/lunchtable-tcg-story/src/client/index.ts",
      ),
      "@lunchtable-tcg/guilds": path.resolve(
        __dirname,
        "packages/lunchtable-tcg-guilds/src/client/index.ts",
      ),
      "@lunchtable-tcg/engine": path.resolve(
        __dirname,
        "packages/engine/src/index.ts",
      ),
    },
  },
  test: {
    include: [
      "packages/engine/src/**/*.{test,spec}.{js,ts}",
      "packages/plugin-ltcg/src/**/*.{test,spec}.{js,ts}",
      "apps/web/src/**/*.{test,spec}.{js,ts}",
      "convex/**/*.test.{js,ts}",
      "api/**/*.test.{js,ts}",
      "*.test.{js,ts}",
    ],
  },
});
