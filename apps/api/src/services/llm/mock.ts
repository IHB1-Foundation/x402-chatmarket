import type { LLMProvider, LLMCompletionRequest, LLMCompletionResponse, LLMEmbeddingRequest, LLMEmbeddingResponse } from './types.js';

export class MockProvider implements LLMProvider {
  name = 'mock';

  async completion(request: LLMCompletionRequest): Promise<LLMCompletionResponse> {
    // Generate a mock response based on the last user message
    const lastUserMessage = request.messages
      .filter((m) => m.role === 'user')
      .pop();

    const userContent = lastUserMessage?.content || 'Hello';
    const mockResponse = `This is a mock response to: "${userContent}". I am a mock LLM provider used for testing.`;

    const promptTokens = request.messages.reduce((sum, m) => sum + m.content.length / 4, 0);
    const completionTokens = mockResponse.length / 4;

    return {
      content: mockResponse,
      usage: {
        promptTokens: Math.ceil(promptTokens),
        completionTokens: Math.ceil(completionTokens),
        totalTokens: Math.ceil(promptTokens + completionTokens),
      },
    };
  }

  async embedding(request: LLMEmbeddingRequest): Promise<LLMEmbeddingResponse> {
    // Generate a deterministic mock embedding based on the text
    const dimensions = 1536; // Match OpenAI text-embedding-3-small
    const embedding: number[] = [];

    // Create a simple hash-based embedding
    let hash = 0;
    for (let i = 0; i < request.text.length; i++) {
      hash = ((hash << 5) - hash + request.text.charCodeAt(i)) | 0;
    }

    const random = (seed: number) => {
      const x = Math.sin(seed) * 10000;
      return x - Math.floor(x);
    };

    for (let i = 0; i < dimensions; i++) {
      embedding.push(random(hash + i) * 2 - 1);
    }

    // Normalize the vector
    const magnitude = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
    const normalized = embedding.map((v) => v / magnitude);

    return {
      embedding: normalized,
      dimensions,
    };
  }
}
