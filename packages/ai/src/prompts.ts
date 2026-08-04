const promptIdPattern = /^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/u;
const semanticVersionPattern = /^\d+\.\d+\.\d+$/u;

export interface PromptDefinition {
  id: string;
  version: string;
  template: string;
}

export class PromptRegistry {
  private readonly prompts = new Map<string, PromptDefinition>();

  constructor(definitions: readonly PromptDefinition[]) {
    for (const definition of definitions) {
      if (
        !promptIdPattern.test(definition.id) ||
        !semanticVersionPattern.test(definition.version)
      ) {
        throw new Error(`invalid prompt identity: ${definition.id}@${definition.version}`);
      }
      const key = `${definition.id}@${definition.version}`;
      if (this.prompts.has(key)) throw new Error(`duplicate prompt: ${key}`);
      this.prompts.set(key, Object.freeze({ ...definition }));
    }
  }

  get(id: string, version: string) {
    const prompt = this.prompts.get(`${id}@${version}`);
    if (!prompt) throw new Error(`prompt not registered: ${id}@${version}`);
    return prompt;
  }
}
