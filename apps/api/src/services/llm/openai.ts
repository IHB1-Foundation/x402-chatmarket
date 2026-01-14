import type { LLMProvider, LLMCompletionRequest, LLMCompletionResponse, LLMEmbeddingRequest, LLMEmbeddingResponse } from './types.js';
import { getConfig } from '../../config.js';

interface OpenAICompletionResponse {
  choices: Array<{
    message: { content: string };
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface OpenAIEmbeddingResponse {
  data: Array<{
    embedding: number[];
  }>;
}

export class OpenAIProvider implements LLMProvider {
  name = 'openai';
  private apiKey: string;
  private model: string;
  private embeddingModel: string;

  constructor() {
    const config = getConfig();
    if (!config.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is required for OpenAI provider');
    }
    this.apiKey = config.OPENAI_API_KEY;
    this.model = config.LLM_MODEL;
    this.embeddingModel = config.EMBEDDING_MODEL;
  }

  async completion(request: LLMCompletionRequest): Promise<LLMCompletionResponse> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: request.messages,
        max_tokens: request.maxTokens || 1000,
        temperature: request.temperature ?? 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
    }

    const data = (await response.json()) as OpenAICompletionResponse;

    return {
      content: data.choices[0]?.message?.content || '',
      usage: {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      },
    };
  }

  async embedding(request: LLMEmbeddingRequest): Promise<LLMEmbeddingResponse> {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.embeddingModel,
        input: request.text,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
    }

    const data = (await response.json()) as OpenAIEmbeddingResponse;
    const embedding = data.data[0]?.embedding || [];

    return {
      embedding,
      dimensions: embedding.length,
    };
  }
}
