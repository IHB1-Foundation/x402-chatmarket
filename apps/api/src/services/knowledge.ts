import { getPool } from '../lib/db.js';
import { generateEmbedding } from './llm/index.js';

export interface QAItem {
  question: string;
  answer: string;
}

export interface DocumentChunk {
  title: string;
  content: string;
}

export interface StoredDocument {
  id: string;
  moduleId: string;
  sourceType: 'qa' | 'doc';
  title: string;
  content: string;
  createdAt: Date;
}

export interface RetrievedDocument extends StoredDocument {
  similarity: number;
}

// Chunk large documents into smaller pieces
function chunkDocument(title: string, content: string, maxChunkSize = 1000): DocumentChunk[] {
  if (content.length <= maxChunkSize) {
    return [{ title, content }];
  }

  const chunks: DocumentChunk[] = [];
  const paragraphs = content.split(/\n\n+/);
  let currentChunk = '';
  let chunkIndex = 0;

  for (const paragraph of paragraphs) {
    if (currentChunk.length + paragraph.length + 2 > maxChunkSize && currentChunk.length > 0) {
      chunks.push({
        title: `${title} [Part ${chunkIndex + 1}]`,
        content: currentChunk.trim(),
      });
      currentChunk = '';
      chunkIndex++;
    }
    currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
  }

  if (currentChunk.trim()) {
    chunks.push({
      title: chunks.length > 0 ? `${title} [Part ${chunkIndex + 1}]` : title,
      content: currentChunk.trim(),
    });
  }

  return chunks;
}

// Ingest Q/A pairs into module_documents
export async function ingestQAPairs(moduleId: string, items: QAItem[]): Promise<StoredDocument[]> {
  const pool = getPool();
  const stored: StoredDocument[] = [];

  for (const item of items) {
    // Create combined text for embedding
    const combinedText = `Q: ${item.question}\nA: ${item.answer}`;
    const embeddingResult = await generateEmbedding(combinedText);

    // Format embedding as pgvector string
    const embeddingVector = `[${embeddingResult.embedding.join(',')}]`;

    const result = await pool.query(
      `INSERT INTO module_documents (module_id, source_type, title, content, embedding)
       VALUES ($1, 'qa', $2, $3, $4::vector)
       RETURNING id, module_id, source_type, title, content, created_at`,
      [moduleId, item.question, item.answer, embeddingVector]
    );

    const row = result.rows[0];
    stored.push({
      id: row.id,
      moduleId: row.module_id,
      sourceType: row.source_type,
      title: row.title,
      content: row.content,
      createdAt: row.created_at,
    });
  }

  return stored;
}

// Ingest documents (chunking + embedding)
export async function ingestDocuments(
  moduleId: string,
  documents: DocumentChunk[]
): Promise<StoredDocument[]> {
  const pool = getPool();
  const stored: StoredDocument[] = [];

  for (const doc of documents) {
    // Chunk the document if needed
    const chunks = chunkDocument(doc.title, doc.content);

    for (const chunk of chunks) {
      const embeddingResult = await generateEmbedding(chunk.content);
      const embeddingVector = `[${embeddingResult.embedding.join(',')}]`;

      const result = await pool.query(
        `INSERT INTO module_documents (module_id, source_type, title, content, embedding)
         VALUES ($1, 'doc', $2, $3, $4::vector)
         RETURNING id, module_id, source_type, title, content, created_at`,
        [moduleId, chunk.title, chunk.content, embeddingVector]
      );

      const row = result.rows[0];
      stored.push({
        id: row.id,
        moduleId: row.module_id,
        sourceType: row.source_type,
        title: row.title,
        content: row.content,
        createdAt: row.created_at,
      });
    }
  }

  return stored;
}

// Retrieve top-K similar documents using cosine similarity
export async function retrieveTopK(
  moduleId: string,
  query: string,
  k = 5
): Promise<RetrievedDocument[]> {
  const pool = getPool();

  // Generate embedding for the query
  const queryEmbedding = await generateEmbedding(query);
  const queryVector = `[${queryEmbedding.embedding.join(',')}]`;

  // Use pgvector cosine distance (<=> returns distance, not similarity)
  // 1 - distance = similarity for cosine
  const result = await pool.query(
    `SELECT id, module_id, source_type, title, content, created_at,
            1 - (embedding <=> $2::vector) AS similarity
     FROM module_documents
     WHERE module_id = $1
     ORDER BY embedding <=> $2::vector
     LIMIT $3`,
    [moduleId, queryVector, k]
  );

  return result.rows.map((row) => ({
    id: row.id,
    moduleId: row.module_id,
    sourceType: row.source_type,
    title: row.title,
    content: row.content,
    createdAt: row.created_at,
    similarity: parseFloat(row.similarity),
  }));
}

// Delete all documents for a module
export async function deleteModuleDocuments(moduleId: string): Promise<number> {
  const pool = getPool();
  const result = await pool.query('DELETE FROM module_documents WHERE module_id = $1', [moduleId]);
  return result.rowCount || 0;
}

// Count documents for a module
export async function countModuleDocuments(moduleId: string): Promise<number> {
  const pool = getPool();
  const result = await pool.query(
    'SELECT COUNT(*) as count FROM module_documents WHERE module_id = $1',
    [moduleId]
  );
  return parseInt(result.rows[0].count, 10);
}
