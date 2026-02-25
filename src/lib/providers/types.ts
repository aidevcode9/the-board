import { z } from 'zod';

// ── Provider Abstraction Types ───────────────────────────────────────────────
// Config-driven model selection. DB-first with env var fallback.
// Langfuse v4 (OTel-based) tracing wraps ALL calls via traced.ts.

export const SdkType = z.enum(['anthropic', 'openai', 'google']);
export type SdkType = z.infer<typeof SdkType>;

export const ProviderConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  sdkType: SdkType,
  baseUrl: z.string(),
  apiKey: z.string().min(1),
  isActive: z.boolean(),
});
export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;

export const ModelConfigSchema = z.object({
  id: z.string(),
  providerId: z.string(),
  modelId: z.string(),
  displayName: z.string(),
  inputCostPer1M: z.number().nullable(),
  outputCostPer1M: z.number().nullable(),
  maxContextTokens: z.number().nullable(),
});
export type ModelConfig = z.infer<typeof ModelConfigSchema>;

// ── LLM Message Format ──────────────────────────────────────────────────────

export const LLMMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string(),
});
export type LLMMessage = z.infer<typeof LLMMessageSchema>;

// ── Generation Metadata (attached to every Langfuse trace) ──────────────────

export const GenerationMetadataSchema = z.object({
  debateId: z.string(),
  phase: z.string(),
  persona: z.string(),
  mode: z.enum(['quick', 'compare', 'debate', 'deep']),
  domain: z.string(),
});
export type GenerationMetadata = z.infer<typeof GenerationMetadataSchema>;

// ── Result Types ─────────────────────────────────────────────────────────────

export interface LLMUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface GenerationResult {
  content: string;
  usage: LLMUsage;
  latencyMs: number;
  costUsd: number;
}

export interface StreamChunk {
  text: string;
  done: boolean;
}

export interface StreamingGenerationResult {
  stream: AsyncIterable<StreamChunk>;
  getResult: () => Promise<GenerationResult>;
}

// ── LLM Client Interface ────────────────────────────────────────────────────
// All provider clients implement this. The factory creates the right one
// based on sdkType. Langfuse tracing wraps these calls in traced.ts.

export interface LLMClient {
  readonly sdkType: SdkType;
  readonly providerName: string;
  readonly modelId: string;

  generate(params: {
    messages: LLMMessage[];
    systemPrompt?: string;
    maxTokens?: number;
    temperature?: number;
  }): Promise<GenerationResult>;

  generateStream(params: {
    messages: LLMMessage[];
    systemPrompt?: string;
    maxTokens?: number;
    temperature?: number;
  }): Promise<StreamingGenerationResult>;

  testConnection(): Promise<{
    success: boolean;
    latencyMs: number;
    error?: string;
  }>;
}

// ── Env Var Fallback Map ────────────────────────────────────────────────────
// When no DB config exists, fall back to these env vars per provider name.

export const ENV_FALLBACK_MAP: Record<
  string,
  { sdkType: SdkType; baseUrl: string; envKey: string }
> = {
  anthropic: {
    sdkType: 'anthropic',
    baseUrl: 'https://api.anthropic.com',
    envKey: 'ANTHROPIC_API_KEY',
  },
  openai: {
    sdkType: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    envKey: 'OPENAI_API_KEY',
  },
  google: {
    sdkType: 'google',
    baseUrl: 'https://generativelanguage.googleapis.com',
    envKey: 'GOOGLE_GENERATIVE_AI_API_KEY',
  },
  deepseek: {
    sdkType: 'openai',
    baseUrl: 'https://api.deepseek.com',
    envKey: 'DEEPSEEK_API_KEY',
  },
  groq: {
    sdkType: 'openai',
    baseUrl: 'https://api.groq.com/openai/v1',
    envKey: 'GROQ_API_KEY',
  },
  'lm-studio': {
    sdkType: 'openai',
    baseUrl: 'http://localhost:1234/v1',
    envKey: 'LM_STUDIO_API_KEY',
  },
};
