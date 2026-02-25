import OpenAI from 'openai';
import type {
  GenerationResult,
  LLMClient,
  LLMMessage,
  ProviderConfig,
  StreamChunk,
  StreamingGenerationResult,
} from './types';

const DEFAULT_MAX_TOKENS = 4096;
const SDK_TIMEOUT_MS = 30_000;
const SDK_MAX_RETRIES = 2;

/**
 * OpenAI-compatible SDK client implementing LLMClient interface.
 * Shared by: OpenAI, DeepSeek, Groq, LM Studio (all expose OpenAI-compatible APIs).
 * Just change the baseURL and apiKey.
 */
export class OpenAICompatClient implements LLMClient {
  readonly sdkType = 'openai' as const;
  readonly providerName: string;
  readonly modelId: string;
  private readonly client: OpenAI;

  constructor(config: ProviderConfig, modelId: string) {
    this.providerName = config.name;
    this.modelId = modelId;
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
      timeout: SDK_TIMEOUT_MS,
      maxRetries: SDK_MAX_RETRIES,
    });
  }

  async generate(params: {
    messages: LLMMessage[];
    systemPrompt?: string;
    maxTokens?: number;
    temperature?: number;
  }): Promise<GenerationResult> {
    const start = Date.now();
    const messages = this.buildMessages(params.messages, params.systemPrompt);

    const response = await this.client.chat.completions.create({
      model: this.modelId,
      messages,
      max_tokens: params.maxTokens ?? DEFAULT_MAX_TOKENS,
      ...(params.temperature !== undefined ? { temperature: params.temperature } : {}),
    });

    const latencyMs = Date.now() - start;

    return {
      content: response.choices[0]?.message?.content ?? '',
      usage: {
        inputTokens: response.usage?.prompt_tokens ?? 0,
        outputTokens: response.usage?.completion_tokens ?? 0,
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

    const messages = this.buildMessages(params.messages, params.systemPrompt);

    const rawStream = await this.client.chat.completions.create({
      model: this.modelId,
      messages,
      max_tokens: params.maxTokens ?? DEFAULT_MAX_TOKENS,
      stream: true,
      stream_options: { include_usage: true },
      ...(params.temperature !== undefined ? { temperature: params.temperature } : {}),
    });

    let finalInputTokens = 0;
    let finalOutputTokens = 0;

    const stream = (async function* (): AsyncIterable<StreamChunk> {
      for await (const chunk of rawStream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          fullContent += delta;
          yield { text: delta, done: false };
        }
        if (chunk.usage) {
          finalInputTokens = chunk.usage.prompt_tokens;
          finalOutputTokens = chunk.usage.completion_tokens;
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
      await this.client.chat.completions.create({
        model: this.modelId,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 10,
      });
      return { success: true, latencyMs: Date.now() - start };
    } catch (err) {
      return {
        success: false,
        latencyMs: Date.now() - start,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }

  private buildMessages(
    messages: LLMMessage[],
    systemPrompt?: string,
  ): OpenAI.ChatCompletionMessageParam[] {
    const result: OpenAI.ChatCompletionMessageParam[] = [];
    if (systemPrompt) {
      result.push({ role: 'system', content: systemPrompt });
    }
    for (const msg of messages) {
      result.push({ role: msg.role, content: msg.content });
    }
    return result;
  }
}
