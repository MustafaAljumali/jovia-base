# AI Provider Runtime

The `@jovia/ai` package is the only supported route to model providers. Business
services depend on `AiProvider` and `AiTaskRouter`; they never import provider SDKs.
`packages/ai/src/providers/gemini/client.ts` is the sole Google SDK boundary.

## Runtime policy

- Gemini is disabled until configuration validates both a credential and the stable
  model ID `gemini-3.6-flash`.
- Task policies declare a primary, ordered fallbacks, timeout, maximum attempts,
  capabilities, output schema, prompt version, and safety policy.
- Authentication, safety, client, and validation errors do not retry. Timeouts,
  rate limits, provider outages, and unknown transport failures may retry within
  the configured bound and then fail over.
- Structured output is parsed and validated before it reaches a service.
- Audit records store identifiers, timing, normalized outcomes, usage, and cost;
  raw prompts and credentials are excluded by default.
- Streaming emits ordered deltas, at most one usage event, and one terminal event.

The health endpoint must use recorded configuration and outcomes. It must never
issue a paid model request merely to report health.
