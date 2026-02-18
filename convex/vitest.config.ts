import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		// Convex component packages use a custom export condition to point at source
		// (since `dist/` is not committed). Enable it for Vitest runs.
		conditions: ["@convex-dev/component-source", "import", "default"],
	},
	test: {
		include: ["convex/**/*.test.ts"],
	},
});
