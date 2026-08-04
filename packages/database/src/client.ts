import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema/index.js";

export type JoviaDatabase = PostgresJsDatabase<typeof schema>;

export function createDatabase(url: string) {
  const client = postgres(url, { max: 10, prepare: false });
  return {
    db: drizzle(client, { schema }),
    sql: client,
    close: () => client.end({ timeout: 5 }),
  };
}
