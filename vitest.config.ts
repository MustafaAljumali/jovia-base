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
          exclude: ["**/*.integration.test.{ts,tsx}"],
          include: ["**/*.{test,spec}.{ts,tsx}"],
          name: "unit",
        },
      },
      {
        test: {
          include: ["**/*.integration.test.{ts,tsx}"],
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
