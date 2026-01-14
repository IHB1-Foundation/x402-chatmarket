import { getPool } from '../lib/db.js';
import { retrieveTopK, RetrievedDocument } from './knowledge.js';
import { generateCompletion, LLMCompletionResponse } from './llm/index.js';

export interface RAGRequest {
  moduleId: string;
  userMessage: string;
  chatHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  maxContextDocs?: number;
}

export interface RAGResponse {
  reply: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  context: {
    documentsUsed: number;
    topDocuments: Array<{
      title: string;
      similarity: number;
    }>;
  };
}

interface ModuleData {
  id: string;
  personaPrompt: string;
  name: string;
}

// Build the context string from retrieved documents
function buildContextString(docs: RetrievedDocument[]): string {
  if (docs.length === 0) return '';

  const contextParts = docs.map((doc, i) => {
    const prefix = doc.sourceType === 'qa' ? `Q: ${doc.title}\nA: ` : `[${doc.title}]\n`;
    return `[${i + 1}] ${prefix}${doc.content}`;
  });

  return contextParts.join('\n\n');
}

// Build messages array for LLM
function buildMessages(
  module: ModuleData,
  contextString: string,
  userMessage: string,
  chatHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];

  // System message with persona
  const systemPrompt = module.personaPrompt || `You are ${module.name}, a helpful AI assistant.`;

  const systemMessage = `${systemPrompt}

## Instructions
- Answer the user's questions based on the CONTEXT provided below.
- If the answer is not in the CONTEXT, say "I don't have information about that in my knowledge base."
- Be concise and helpful.
- Do not make up information not present in the CONTEXT.

## CONTEXT
${contextString || '(No relevant context found)'}`;

  messages.push({ role: 'system', content: systemMessage });

  // Add chat history if provided
  if (chatHistory && chatHistory.length > 0) {
    for (const msg of chatHistory) {
      messages.push({ role: msg.role, content: msg.content });
    }
  }

  // Add current user message
  messages.push({ role: 'user', content: userMessage });

  return messages;
}

// Main RAG function
export async function executeRAG(request: RAGRequest): Promise<RAGResponse> {
  const { moduleId, userMessage, chatHistory, maxContextDocs = 5 } = request;
  const pool = getPool();

  // Fetch module data
  const moduleResult = await pool.query(
    'SELECT id, persona_prompt, name FROM modules WHERE id = $1',
    [moduleId]
  );

  if (moduleResult.rows.length === 0) {
    throw new Error('Module not found');
  }

  const module: ModuleData = {
    id: moduleResult.rows[0].id,
    personaPrompt: moduleResult.rows[0].persona_prompt,
    name: moduleResult.rows[0].name,
  };

  // Retrieve relevant documents
  const relevantDocs = await retrieveTopK(moduleId, userMessage, maxContextDocs);

  // Build context string
  const contextString = buildContextString(relevantDocs);

  // Build messages
  const messages = buildMessages(module, contextString, userMessage, chatHistory);

  // Generate completion
  const completion = await generateCompletion(messages, {
    maxTokens: 1000,
    temperature: 0.7,
  });

  return {
    reply: completion.content,
    usage: completion.usage,
    context: {
      documentsUsed: relevantDocs.length,
      topDocuments: relevantDocs.map((doc) => ({
        title: doc.title,
        similarity: doc.similarity,
      })),
    },
  };
}

// Test RAG with a simple query (for verification)
export async function testRAG(moduleId: string, query: string): Promise<{
  query: string;
  reply: string;
  contextDocs: number;
  topDocs: Array<{ title: string; similarity: number }>;
}> {
  const result = await executeRAG({
    moduleId,
    userMessage: query,
  });

  return {
    query,
    reply: result.reply,
    contextDocs: result.context.documentsUsed,
    topDocs: result.context.topDocuments,
  };
}
