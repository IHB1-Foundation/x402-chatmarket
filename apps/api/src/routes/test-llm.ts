import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getLLMProvider, generateCompletion, generateEmbedding } from '../services/llm/index.js';

export async function testLLMRoutes(fastify: FastifyInstance): Promise<void> {
  // Test completion endpoint
  fastify.post<{ Body: { message: string } }>(
    '/api/test/llm/completion',
    async (request: FastifyRequest<{ Body: { message: string } }>, reply: FastifyReply) => {
      const { message } = request.body || { message: 'Hello' };

      const provider = getLLMProvider();
      const result = await generateCompletion([
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: message },
      ]);

      return reply.send({
        provider: provider.name,
        response: result.content,
        usage: result.usage,
      });
    }
  );

  // Test embedding endpoint
  fastify.post<{ Body: { text: string } }>(
    '/api/test/llm/embedding',
    async (request: FastifyRequest<{ Body: { text: string } }>, reply: FastifyReply) => {
      const { text } = request.body || { text: 'Hello world' };

      const provider = getLLMProvider();
      const result = await generateEmbedding(text);

      return reply.send({
        provider: provider.name,
        dimensions: result.dimensions,
        embeddingPreview: result.embedding.slice(0, 5),
      });
    }
  );

  // Info endpoint
  fastify.get('/api/test/llm/info', async (_, reply) => {
    const provider = getLLMProvider();
    return reply.send({
      provider: provider.name,
    });
  });
}
