import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const sql = postgres(databaseUrl, { max: 1 });
try {
  const extensions = await sql<{ extname: string }[]>`
    SELECT extname FROM pg_extension WHERE extname IN ('vector', 'pgcrypto') ORDER BY extname
  `;
  const names = extensions.map(({ extname }) => extname);
  if (!names.includes("vector") || !names.includes("pgcrypto")) {
    throw new Error("Required PostgreSQL extensions are missing");
  }
  process.stdout.write("PostgreSQL foundation check passed.\n");
} finally {
  await sql.end({ timeout: 5 });
}
