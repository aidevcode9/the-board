import Anthropic from '@anthropic-ai/sdk';
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages';
import type {
  GenerationResult,
  LLMClient,
  LLMMessage,
  ProviderConfig,
  StreamChunk,
  StreamingGenerationResult,
} from './types';

const DEFAULT_MAX_TOKENS = 4096;
const SDK_TIMEOUT_MS = 30_000; // 30s timeout for API calls
const SDK_MAX_RETRIES = 2; // Retry on transient errors (429, 503)

/** Convert LLMMessage[] to Anthropic MessageParam[] (strips system messages). */
function toAnthropicMessages(messages: LLMMessage[]): MessageParam[] {
  return messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));
}

/**
 * Anthropic SDK client implementing LLMClient interface.
 * Uses `client.messages.create()` for both streaming and non-streaming.
 */
export class AnthropicClient implements LLMClient {
  readonly sdkType = 'anthropic' as const;
  readonly providerName: string;
  readonly modelId: string;
  private readonly client: Anthropic;

  constructor(config: ProviderConfig, modelId: string) {
    this.providerName = config.name;
    this.modelId = modelId;
    this.client = new Anthropic({
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

    const response = await this.client.messages.create({
      model: this.modelId,
      max_tokens: params.maxTokens ?? DEFAULT_MAX_TOKENS,
      messages: toAnthropicMessages(params.messages),
      ...(params.systemPrompt ? { system: params.systemPrompt } : {}),
      ...(params.temperature !== undefined ? { temperature: params.temperature } : {}),
    });

    const latencyMs = Date.now() - start;
    const content = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');

    return {
      content,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
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
    let inputTokens = 0;
    let outputTokens = 0;
    let fullContent = '';

    const rawStream = this.client.messages.stream({
      model: this.modelId,
      max_tokens: params.maxTokens ?? DEFAULT_MAX_TOKENS,
      messages: toAnthropicMessages(params.messages),
      ...(params.systemPrompt ? { system: params.systemPrompt } : {}),
      ...(params.temperature !== undefined ? { temperature: params.temperature } : {}),
    });

    const stream = (async function* (): AsyncIterable<StreamChunk> {
      for await (const event of rawStream) {
        if (event.type === 'message_start' && event.message.usage) {
          inputTokens = event.message.usage.input_tokens;
        }
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          fullContent += event.delta.text;
          yield { text: event.delta.text, done: false };
        }
        if (event.type === 'message_delta' && event.usage) {
          outputTokens = event.usage.output_tokens;
        }
      }
      yield { text: '', done: true };
    })();

    return {
      stream,
      getResult: async () => ({
        content: fullContent,
        usage: { inputTokens, outputTokens },
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
      await this.client.messages.create({
        model: this.modelId,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'ping' }],
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
}
