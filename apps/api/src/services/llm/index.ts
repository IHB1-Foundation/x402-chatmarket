import type { LLMProvider } from './types.js';
import { MockProvider } from './mock.js';
import { OpenAIProvider } from './openai.js';
import { getConfig } from '../../config.js';

export type { LLMProvider, LLMMessage, LLMCompletionRequest, LLMCompletionResponse, LLMEmbeddingRequest, LLMEmbeddingResponse } from './types.js';

let provider: LLMProvider | null = null;

export function getLLMProvider(): LLMProvider {
  if (!provider) {
    const config = getConfig();

    switch (config.LLM_PROVIDER) {
      case 'openai':
        provider = new OpenAIProvider();
        break;
      case 'anthropic':
        // TODO: Implement Anthropic provider when needed
        throw new Error('Anthropic provider not yet implemented');
      case 'mock':
      default:
        provider = new MockProvider();
        break;
    }

    console.log(`LLM Provider initialized: ${provider.name}`);
  }

  return provider;
}

// Convenience functions
export async function generateCompletion(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  options?: { maxTokens?: number; temperature?: number }
) {
  const llm = getLLMProvider();
  return llm.completion({
    messages,
    maxTokens: options?.maxTokens,
    temperature: options?.temperature,
  });
}

export async function generateEmbedding(text: string) {
  const llm = getLLMProvider();
  return llm.embedding({ text });
}
