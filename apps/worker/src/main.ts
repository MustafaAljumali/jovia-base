import { loadWorkerConfig, toRedactedConfig } from "@jovia/config";
import { createLogger } from "@jovia/observability";

import { createWorkerRuntime } from "./runtime.js";

async function main() {
  const config = loadWorkerConfig(process.env);
  const logger = createLogger({
    service: "jovia-worker",
    environment: config.environment,
    level: config.logLevel,
  });
  const runtime = createWorkerRuntime([]);
  await runtime.start();
  logger.info({ config: toRedactedConfig(config) }, "Worker runtime started");

  const shutdown = async (signal: string) => {
    logger.info({ signal }, "Worker runtime stopping");
    await runtime.stop();
  };
  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((error: unknown) => {
  process.stderr.write(
    `Worker startup failed: ${error instanceof Error ? error.message : "unknown error"}\n`,
  );
  process.exitCode = 1;
});
