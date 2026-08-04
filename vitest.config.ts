import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      exclude: [
        "**/*.config.{js,mjs,ts}",
        "**/*.d.ts",
        "**/dist/**",
        "**/node_modules/**",
        "**/providers/gemini/client.ts",
        "apps/*/src/main.ts*",
        "apps/api/src/server.ts",
      ],
      include: ["apps/**/*.{ts,tsx}", "packages/**/*.ts", "services/**/*.ts"],
      provider: "v8",
      reporter: ["text", "json-summary", "lcov"],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
    projects: [
      {
        test: {
          exclude: ["**/node_modules/**", "**/*.integration.test.{ts,tsx}"],
          include: ["{apps,packages,services,scripts}/**/*.{test,spec}.{ts,tsx}"],
          name: "unit",
        },
      },
      {
        test: {
          exclude: ["**/node_modules/**"],
          include: ["{apps,packages,services}/**/*.integration.test.{ts,tsx}"],
          name: "integration",
          sequence: { concurrent: false },
          testTimeout: 30_000,
        },
      },
    ],
    reporters: ["default"],
    restoreMocks: true,
  },
});
