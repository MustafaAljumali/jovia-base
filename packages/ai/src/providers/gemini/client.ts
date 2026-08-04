import { GoogleGenAI, type GenerateContentResponse } from "@google/genai";

export interface GeminiRawUsage {
  promptTokenCount?: number | undefined;
  candidatesTokenCount?: number | undefined;
  totalTokenCount?: number | undefined;
}

export interface GeminiRawResponse {
  text?: string | undefined;
  usage?: GeminiRawUsage | undefined;
  finishReason?: string | undefined;
  responseId?: string | undefined;
  blocked?: boolean | undefined;
}

export interface GeminiGenerateRequest {
  model: string;
  prompt: string;
  signal: AbortSignal;
  responseJsonSchema?: unknown;
}

export interface GeminiClient {
  generate(request: GeminiGenerateRequest): Promise<GeminiRawResponse>;
  stream(request: GeminiGenerateRequest): AsyncIterable<GeminiRawResponse>;
}

function toRawResponse(response: GenerateContentResponse): GeminiRawResponse {
  return {
    text: response.text,
    usage: response.usageMetadata,
    finishReason: response.candidates?.[0]?.finishReason,
    responseId: response.responseId,
    blocked: Boolean(response.promptFeedback?.blockReason),
  };
}

export function createGeminiClient(config: { apiKey: string }): GeminiClient {
  const client = new GoogleGenAI({ apiKey: config.apiKey });
  const parameters = (request: GeminiGenerateRequest) => ({
    model: request.model,
    contents: request.prompt,
    config: {
      abortSignal: request.signal,
      ...(request.responseJsonSchema
        ? { responseMimeType: "application/json", responseJsonSchema: request.responseJsonSchema }
        : {}),
    },
  });
  return {
    async generate(request) {
      return toRawResponse(await client.models.generateContent(parameters(request)));
    },
    async *stream(request) {
      const chunks = await client.models.generateContentStream(parameters(request));
      for await (const chunk of chunks) yield toRawResponse(chunk);
    },
  };
}
