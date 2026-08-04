import type { SourceRegistration } from "@jovia/contracts";
import { eq } from "drizzle-orm";

import type { JoviaDatabase } from "../client.js";
import { sourceRegistry } from "../schema/source-registry.js";

export class SourceRegistryRepository {
  constructor(private readonly database: JoviaDatabase) {}

  async save(source: SourceRegistration): Promise<void> {
    const values = {
      ...source,
      lastVerifiedAt: new Date(source.lastVerifiedAt),
      updatedAt: new Date(),
    };
    await this.database
      .insert(sourceRegistry)
      .values(values)
      .onConflictDoUpdate({ target: sourceRegistry.code, set: values });
  }

  async findByCode(code: string) {
    const [source] = await this.database
      .select()
      .from(sourceRegistry)
      .where(eq(sourceRegistry.code, code))
      .limit(1);
    return source;
  }
}
