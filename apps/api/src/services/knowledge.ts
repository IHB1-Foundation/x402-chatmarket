import { getPool } from '../lib/db.js';
import { generateEmbedding } from './llm/index.js';

type EmbeddingBackend = 'pgvector' | 'text' | 'none';

let embeddingBackendPromise: Promise<EmbeddingBackend> | null = null;

async function getEmbeddingBackend(): Promise<EmbeddingBackend> {
  if (!embeddingBackendPromise) {
    embeddingBackendPromise = (async () => {
      const pool = getPool();

      try {
        const table = await pool.query<{ regclass: string | null }>(
          'SELECT to_regclass($1) as regclass',
          ['public.module_documents']
        );
        if (!table.rows[0]?.regclass) return 'none';

        const col = await pool.query<{ data_type: string; udt_name: string }>(
          `SELECT data_type, udt_name
           FROM information_schema.columns
           WHERE table_schema = 'public'
             AND table_name = 'module_documents'
             AND column_name = 'embedding'
           LIMIT 1`
        );

        const row = col.rows[0];
        if (row?.udt_name === 'vector') return 'pgvector';
        return 'text';
      } catch {
        return 'none';
      }
    })();
  }

  return embeddingBackendPromise;
}

function parseEmbedding(value: unknown): number[] | null {
  if (!value) return null;
  if (Array.isArray(value) && value.every((v) => typeof v === 'number')) return value as number[];

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed) && parsed.every((v) => typeof v === 'number')) return parsed as number[];
    } catch {
      return null;
    }
  }

  return null;
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

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
  const backend = await getEmbeddingBackend();

  for (const item of items) {
    // Create combined text for embedding
    const combinedText = `Q: ${item.question}\nA: ${item.answer}`;
    const embeddingResult = backend === 'none' ? null : await generateEmbedding(combinedText);

    const result =
      backend === 'pgvector'
        ? await pool.query(
            `INSERT INTO module_documents (module_id, source_type, title, content, embedding)
             VALUES ($1, 'qa', $2, $3, $4::vector)
             RETURNING id, module_id, source_type, title, content, created_at`,
            [moduleId, item.question, item.answer, `[${embeddingResult!.embedding.join(',')}]`]
          )
        : await pool.query(
            `INSERT INTO module_documents (module_id, source_type, title, content, embedding)
             VALUES ($1, 'qa', $2, $3, $4)
             RETURNING id, module_id, source_type, title, content, created_at`,
            [moduleId, item.question, item.answer, embeddingResult ? JSON.stringify(embeddingResult.embedding) : null]
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
  const backend = await getEmbeddingBackend();

  for (const doc of documents) {
    // Chunk the document if needed
    const chunks = chunkDocument(doc.title, doc.content);

    for (const chunk of chunks) {
      const embeddingResult = backend === 'none' ? null : await generateEmbedding(chunk.content);

      const result =
        backend === 'pgvector'
          ? await pool.query(
              `INSERT INTO module_documents (module_id, source_type, title, content, embedding)
               VALUES ($1, 'doc', $2, $3, $4::vector)
               RETURNING id, module_id, source_type, title, content, created_at`,
              [moduleId, chunk.title, chunk.content, `[${embeddingResult!.embedding.join(',')}]`]
            )
          : await pool.query(
              `INSERT INTO module_documents (module_id, source_type, title, content, embedding)
               VALUES ($1, 'doc', $2, $3, $4)
               RETURNING id, module_id, source_type, title, content, created_at`,
              [moduleId, chunk.title, chunk.content, embeddingResult ? JSON.stringify(embeddingResult.embedding) : null]
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
  const backend = await getEmbeddingBackend();

  if (backend === 'none') return [];

  // Generate embedding for the query
  const queryEmbedding = await generateEmbedding(query);
  const queryVector = `[${queryEmbedding.embedding.join(',')}]`;

  if (backend === 'pgvector') {
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

  // Fallback: compute cosine similarity in JS using stored embedding JSON (text/jsonb).
  const result = await pool.query(
    `SELECT id, module_id, source_type, title, content, embedding, created_at
     FROM module_documents
     WHERE module_id = $1`,
    [moduleId]
  );

  const scored = result.rows.map((row) => {
    const embedding = parseEmbedding(row.embedding);
    const similarity = embedding ? cosineSimilarity(queryEmbedding.embedding, embedding) : 0;
    return {
      id: row.id,
      moduleId: row.module_id,
      sourceType: row.source_type,
      title: row.title,
      content: row.content,
      createdAt: row.created_at,
      similarity,
    } satisfies RetrievedDocument;
  });

  scored.sort((a, b) => b.similarity - a.similarity);
  return scored.slice(0, k);
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
