import { GoogleGenerativeAI } from '@google/generative-ai';
import type {
  GenerationResult,
  LLMClient,
  LLMMessage,
  ProviderConfig,
  StreamChunk,
  StreamingGenerationResult,
} from './types';

const DEFAULT_MAX_TOKENS = 4096;
// Note: Google GenAI SDK doesn't expose timeout/retry constructor options.
// Timeout is handled via requestOptions per call. Retry is not built-in.
// Phase 2 (Trigger.dev) handles retries at the durable execution level.

/**
 * Google Generative AI SDK client implementing LLMClient interface.
 * Uses @google/generative-ai (not Vertex AI).
 *
 * Key difference from OpenAI/Anthropic: role is "model" not "assistant",
 * and content is `parts: [{text}]` not plain `content: string`.
 */
export class GoogleClient implements LLMClient {
  readonly sdkType = 'google' as const;
  readonly providerName: string;
  readonly modelId: string;
  private readonly genAI: GoogleGenerativeAI;

  constructor(config: ProviderConfig, modelId: string) {
    this.providerName = config.name;
    this.modelId = modelId;
    this.genAI = new GoogleGenerativeAI(config.apiKey);
  }

  async generate(params: {
    messages: LLMMessage[];
    systemPrompt?: string;
    maxTokens?: number;
    temperature?: number;
  }): Promise<GenerationResult> {
    const start = Date.now();
    const model = this.getModel(params);

    const contents = this.convertMessages(params.messages);
    const response = await model.generateContent({ contents });

    const latencyMs = Date.now() - start;
    const result = response.response;
    const text = result.text();
    const usage = result.usageMetadata;

    return {
      content: text,
      usage: {
        inputTokens: usage?.promptTokenCount ?? 0,
        outputTokens: usage?.candidatesTokenCount ?? 0,
      },
      latencyMs,
      costUsd: 0, // Calculated externally via calculateCost()
    };
  }

  async generateStream(params: {
    messages: LLMMessage[];
    systemPrompt?: string;
    maxTokens?: number;
    temperature?: number;
  }): Promise<StreamingGenerationResult> {
    const start = Date.now();
    let fullContent = '';
    let finalInputTokens = 0;
    let finalOutputTokens = 0;

    const model = this.getModel(params);
    const contents = this.convertMessages(params.messages);
    const rawStream = await model.generateContentStream({ contents });

    const stream = (async function* (): AsyncIterable<StreamChunk> {
      for await (const chunk of rawStream.stream) {
        const text = chunk.text();
        if (text) {
          fullContent += text;
          yield { text, done: false };
        }
        if (chunk.usageMetadata) {
          finalInputTokens = chunk.usageMetadata.promptTokenCount ?? 0;
          finalOutputTokens = chunk.usageMetadata.candidatesTokenCount ?? 0;
        }
      }
      yield { text: '', done: true };
    })();

    return {
      stream,
      getResult: async () => ({
        content: fullContent,
        usage: {
          inputTokens: finalInputTokens,
          outputTokens: finalOutputTokens,
        },
        latencyMs: Date.now() - start,
        costUsd: 0,
      }),
    };
  }

  async testConnection(): Promise<{
    success: boolean;
    latencyMs: number;
    error?: string;
  }> {
    const start = Date.now();
    try {
      const model = this.genAI.getGenerativeModel({ model: this.modelId });
      await model.generateContent('ping');
      return { success: true, latencyMs: Date.now() - start };
    } catch (err) {
      return {
        success: false,
        latencyMs: Date.now() - start,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }

  private getModel(params: {
    systemPrompt?: string;
    maxTokens?: number;
    temperature?: number;
  }) {
    return this.genAI.getGenerativeModel({
      model: this.modelId,
      ...(params.systemPrompt ? { systemInstruction: params.systemPrompt } : {}),
      generationConfig: {
        maxOutputTokens: params.maxTokens ?? DEFAULT_MAX_TOKENS,
        ...(params.temperature !== undefined ? { temperature: params.temperature } : {}),
      },
    });
  }

  /**
   * Convert LLMMessage[] to Google's Content[] format.
   * Google uses "model" instead of "assistant", and parts: [{text}] instead of content.
   */
  private convertMessages(
    messages: LLMMessage[],
  ): Array<{ role: string; parts: Array<{ text: string }> }> {
    return messages
      .filter((m) => m.role !== 'system') // system prompt handled via systemInstruction
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));
  }
}
