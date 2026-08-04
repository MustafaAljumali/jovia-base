import { loadApiConfig } from "@jovia/config";
import { createLogger } from "@jovia/observability";

import { createApiApp } from "./app.js";

async function main() {
  const config = loadApiConfig(process.env);
  const logger = createLogger({
    service: "jovia-api",
    environment: config.environment,
    level: config.logLevel,
  });
  const app = await createApiApp({ config, logger });
  await app.listen({ host: config.host, port: config.port });
}

main().catch((error: unknown) => {
  process.stderr.write(
    `API startup failed: ${error instanceof Error ? error.message : "unknown error"}\n`,
  );
  process.exitCode = 1;
});
