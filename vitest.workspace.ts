import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  "api/vitest.config.ts",
  "packages/engine/vitest.config.ts",
  "apps/web/vitest.config.ts",
]);
