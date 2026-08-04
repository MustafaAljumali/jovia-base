import type { AiProvider } from "./contracts.js";

export class AiProviderRegistry {
  private readonly providers = new Map<string, AiProvider>();

  constructor(providers: readonly AiProvider[]) {
    for (const provider of providers) {
      if (this.providers.has(provider.id)) throw new Error(`duplicate AI provider: ${provider.id}`);
      this.providers.set(provider.id, provider);
    }
  }

  get(id: string): AiProvider {
    const provider = this.providers.get(id);
    if (!provider) throw new Error(`AI provider is not registered: ${id}`);
    return provider;
  }

  has(id: string) {
    return this.providers.has(id);
  }

  ids() {
    return [...this.providers.keys()];
  }
}
