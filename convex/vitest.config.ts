import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		// Our workspace packages use conditional exports to point at TS sources in dev/test.
		conditions: ["@convex-dev/component-source"],
	},
	ssr: {
		resolve: {
			conditions: ["@convex-dev/component-source"],
		},
	},
	test: {
		include: ["convex/**/*.test.ts"],
	},
});
