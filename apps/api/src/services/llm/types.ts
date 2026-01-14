export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMCompletionRequest {
  messages: LLMMessage[];
  maxTokens?: number;
  temperature?: number;
}

export interface LLMCompletionResponse {
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface LLMEmbeddingRequest {
  text: string;
}

export interface LLMEmbeddingResponse {
  embedding: number[];
  dimensions: number;
}

export interface LLMProvider {
  name: string;
  completion(request: LLMCompletionRequest): Promise<LLMCompletionResponse>;
  embedding(request: LLMEmbeddingRequest): Promise<LLMEmbeddingResponse>;
}
