# Local Development

## Prerequisites

- Git with SSH commit signing configured for this repository.
- Node.js 24.14.0 and pnpm 11.20.0.
- Docker Engine or Docker Desktop with Compose v2 for integration work.

## First run

```powershell
pnpm install --frozen-lockfile
Copy-Item .env.example .env
docker compose up -d --wait postgres redis
pnpm db:migrate
pnpm db:check
pnpm check
```

Run `pnpm dev:web`, `pnpm dev:api`, and `pnpm dev:worker` in separate terminals.
`GET http://127.0.0.1:4000/v1/health` should return status `ok`, service
`jovia-api`, the application version, and an ISO timestamp. The response includes
`x-correlation-id`; a valid caller-supplied ID is preserved.

To run infrastructure tests explicitly:

```powershell
$env:RUN_INTEGRATION_TESTS='true'
pnpm test:integration
Remove-Item Env:RUN_INTEGRATION_TESTS
```

Stop services with `docker compose down`. Volumes persist by default. Use
`docker compose down --volumes` only when intentionally discarding local data.

## Troubleshooting

- If port 5432 or 6379 is occupied, stop the conflicting service or change both
  the loopback mapping and `.env` URL.
- If a container is unhealthy, inspect `docker compose ps` and the named service
  logs; do not disable the health check.
- If the lockfile is stale, use pnpm 11.20.0 to update it, review the diff and
  audit output, then rerun a frozen install.
- Gemini is optional. Keep `AI_GEMINI_ENABLED=false` unless a local credential is
  available outside Git and the model remains exactly `gemini-3.6-flash`.
