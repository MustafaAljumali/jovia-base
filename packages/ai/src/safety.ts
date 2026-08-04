export interface SafetyPolicy {
  id: string;
  blockedTerms?: readonly string[];
  redactPatterns?: readonly RegExp[];
}

export interface SafetyResult {
  outcome: "allowed" | "redacted" | "blocked";
  prompt: string;
}

export class SafetyGuard {
  constructor(private readonly policies: readonly SafetyPolicy[]) {}

  inspect(policyId: string, prompt: string): SafetyResult {
    const policy = this.policies.find(({ id }) => id === policyId);
    if (!policy) throw new Error(`safety policy not registered: ${policyId}`);
    if (policy.blockedTerms?.some((term) => prompt.toLowerCase().includes(term.toLowerCase()))) {
      return { outcome: "blocked", prompt: "" };
    }
    let safePrompt = prompt;
    for (const pattern of policy.redactPatterns ?? [])
      safePrompt = safePrompt.replace(pattern, "[REDACTED]");
    return { outcome: safePrompt === prompt ? "allowed" : "redacted", prompt: safePrompt };
  }
}
