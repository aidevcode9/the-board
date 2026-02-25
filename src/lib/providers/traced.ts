import { type LangfuseGeneration, startObservation } from '@langfuse/tracing';
import { initTelemetry } from './telemetry';
import type {
  GenerationMetadata,
  GenerationResult,
  LLMClient,
  LLMUsage,
  StreamChunk,
  StreamingGenerationResult,
} from './types';

// ── Langfuse-Traced LLM Client Wrapper ──────────────────────────────────────
// ALL model calls in the app MUST go through this wrapper.
// It wraps any LLMClient and adds Langfuse generation observations.
//
// Invariant: No raw API calls bypass this. See CLAUDE.md § Langfuse Telemetry.

/**
 * Wrap an LLMClient with Langfuse tracing.
 * Every generate() and generateStream() call creates a Langfuse generation
 * observation with model, tokens, latency, cost, and debate metadata.
 */
export class TracedLLMClient implements LLMClient {
  readonly sdkType;
  readonly providerName: string;
  readonly modelId: string;
  private readonly inner: LLMClient;
  private readonly metadata: GenerationMetadata;

  constructor(client: LLMClient, metadata: GenerationMetadata) {
    initTelemetry(); // Ensure OTel is initialized (no-op if already done)
    this.inner = client;
    this.metadata = metadata;
    this.sdkType = client.sdkType;
    this.providerName = client.providerName;
    this.modelId = client.modelId;
  }

  async generate(params: {
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
    systemPrompt?: string;
    maxTokens?: number;
    temperature?: number;
  }): Promise<GenerationResult> {
    const generation = this.startGeneration('generate', params);

    try {
      const result = await this.inner.generate(params);
      this.endGeneration(generation, result);
      return result;
    } catch (err) {
      this.endGenerationWithError(generation, err);
      throw err;
    }
  }

  async generateStream(params: {
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
    systemPrompt?: string;
    maxTokens?: number;
    temperature?: number;
  }): Promise<StreamingGenerationResult> {
    const generation = this.startGeneration('generateStream', params);

    try {
      const innerResult = await this.inner.generateStream(params);
      const tracedStream = (async function* (): AsyncIterable<StreamChunk> {
        yield* innerResult.stream;
      })();

      return {
        stream: tracedStream,
        getResult: async () => {
          const result = await innerResult.getResult();
          this.endGeneration(generation, result);
          return result;
        },
      };
    } catch (err) {
      this.endGenerationWithError(generation, err);
      throw err;
    }
  }

  async testConnection(): Promise<{
    success: boolean;
    latencyMs: number;
    error?: string;
  }> {
    // testConnection is not traced — it's an admin action, not a debate call
    return this.inner.testConnection();
  }

  private startGeneration(
    operation: string,
    params: { maxTokens?: number; temperature?: number },
  ): LangfuseGeneration {
    const name = `${this.providerName}/${this.modelId}`;

    return startObservation(
      name,
      {
        model: this.modelId,
        modelParameters: {
          ...(params.maxTokens !== undefined ? { max_tokens: params.maxTokens } : {}),
          ...(params.temperature !== undefined ? { temperature: params.temperature } : {}),
        },
        metadata: {
          provider: this.providerName,
          sdkType: this.sdkType,
          operation,
          ...this.metadata,
        },
      },
      { asType: 'generation' },
    );
  }

  private endGeneration(generation: LangfuseGeneration, result: GenerationResult) {
    const usage = this.formatUsage(result.usage);

    generation.update({
      output: { content: result.content },
      usageDetails: usage,
      metadata: {
        latencyMs: result.latencyMs,
        costUsd: result.costUsd,
      },
    });
    generation.end();
  }

  private endGenerationWithError(generation: LangfuseGeneration, err: unknown) {
    generation.update({
      level: 'ERROR',
      statusMessage: err instanceof Error ? err.message : 'Unknown error',
    });
    generation.end();
  }

  private formatUsage(usage: LLMUsage): Record<string, number> {
    return {
      input: usage.inputTokens,
      output: usage.outputTokens,
      total: usage.inputTokens + usage.outputTokens,
    };
  }
}

/**
 * Convenience: wrap an existing LLMClient with Langfuse tracing.
 * This is the primary entry point for all traced LLM calls.
 */
export function withTracing(client: LLMClient, metadata: GenerationMetadata): TracedLLMClient {
  return new TracedLLMClient(client, metadata);
}
