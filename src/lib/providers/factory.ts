import { AnthropicClient } from './anthropic';
import { GoogleClient } from './google';
import { OpenAICompatClient } from './openai-compat';
import type { LLMClient, ProviderConfig } from './types';

/**
 * Create an LLMClient from a resolved ProviderConfig + model ID.
 * Routes to the correct SDK client based on sdkType.
 *
 * DeepSeek, Groq, and LM Studio all use sdkType 'openai' — just with different baseUrls.
 */
export function createLLMClient(config: ProviderConfig, modelId: string): LLMClient {
  switch (config.sdkType) {
    case 'anthropic':
      return new AnthropicClient(config, modelId);
    case 'openai':
      return new OpenAICompatClient(config, modelId);
    case 'google':
      return new GoogleClient(config, modelId);
    default: {
      const exhaustive: never = config.sdkType;
      throw new Error(`Unknown SDK type: ${exhaustive}`);
    }
  }
}
