import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@jovia/ai": fileURLToPath(new URL("./packages/ai/src/index.ts", import.meta.url)),
      "@jovia/auth": fileURLToPath(new URL("./packages/auth/src/index.ts", import.meta.url)),
      "@jovia/config": fileURLToPath(new URL("./packages/config/src/index.ts", import.meta.url)),
      "@jovia/contracts": fileURLToPath(
        new URL("./packages/contracts/src/index.ts", import.meta.url),
      ),
      "@jovia/database": fileURLToPath(
        new URL("./packages/database/src/index.ts", import.meta.url),
      ),
      "@jovia/localization": fileURLToPath(
        new URL("./packages/localization/src/index.ts", import.meta.url),
      ),
      "@jovia/notifications": fileURLToPath(
        new URL("./packages/notifications/src/index.ts", import.meta.url),
      ),
      "@jovia/observability": fileURLToPath(
        new URL("./packages/observability/src/index.ts", import.meta.url),
      ),
      "@jovia/security": fileURLToPath(
        new URL("./packages/security/src/index.ts", import.meta.url),
      ),
      "@jovia/testing": fileURLToPath(new URL("./packages/testing/src/index.ts", import.meta.url)),
      "@jovia/ui": fileURLToPath(new URL("./packages/ui/src/index.ts", import.meta.url)),
      "@jovia/notification-delivery": fileURLToPath(
        new URL("./services/notification-delivery/src/index.ts", import.meta.url),
      ),
      "@jovia/opportunity-ingestion": fileURLToPath(
        new URL("./services/opportunity-ingestion/src/index.ts", import.meta.url),
      ),
      "@jovia/opportunity-ranking": fileURLToPath(
        new URL("./services/opportunity-ranking/src/index.ts", import.meta.url),
      ),
      "@jovia/opportunity-scoring": fileURLToPath(
        new URL("./services/opportunity-scoring/src/index.ts", import.meta.url),
      ),
      "@jovia/proposal-generation": fileURLToPath(
        new URL("./services/proposal-generation/src/index.ts", import.meta.url),
      ),
    },
  },
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
        "packages/database/scripts/**",
        "packages/database/src/client.ts",
        "packages/database/src/repositories/**",
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
