// ── Provider Abstraction Layer — Public API ─────────────────────────────────
// Usage: import { createLLMClient, withTracing, resolveProviderConfig } from '@/lib/providers';

// Types + schemas
export type {
  GenerationMetadata,
  GenerationResult,
  LLMClient,
  LLMMessage,
  LLMUsage,
  ModelConfig,
  ProviderConfig,
  StreamChunk,
  StreamingGenerationResult,
} from './types';
export {
  GenerationMetadataSchema,
  LLMMessageSchema,
  ModelConfigSchema,
  ProviderConfigSchema,
  SdkType,
  ENV_FALLBACK_MAP,
} from './types';

// Config resolution (DB-first, env fallback)
export { resolveProviderConfig, resolveProviderFromEnv } from './config';

// Cost calculation
export { calculateCost } from './cost';

// Client factory
export { createLLMClient } from './factory';

// Langfuse tracing wrapper (ALL LLM calls go through this)
export { TracedLLMClient, withTracing } from './traced';

// Telemetry init (OTel + Langfuse)
export { initTelemetry, shutdownTelemetry } from './telemetry';

// SSRF protection for provider base URLs
export { validateProviderBaseUrl } from './validate-url';
