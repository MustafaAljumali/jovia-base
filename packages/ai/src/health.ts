import type { AiProvider, ProviderHealth } from "./contracts.js";

export class ProviderHealthRegistry {
  constructor(private readonly providers: readonly AiProvider[]) {}

  async snapshot(): Promise<Record<string, ProviderHealth>> {
    return Object.fromEntries(
      await Promise.all(
        this.providers.map(async (provider) => [provider.id, await provider.health()] as const),
      ),
    );
  }
}
