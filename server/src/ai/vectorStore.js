import 'dotenv/config';
import { randomUUID } from 'node:crypto';

const THRESHOLD = Number(process.env.DEDUP_SIMILARITY_THRESHOLD ?? 0.85);
const INDEX_NAME = process.env.PINECONE_INDEX ?? 'black-excellence-trivia-questions';

let indexPromise = null;

async function getIndex() {
  if (!process.env.PINECONE_API_KEY) {
    throw new Error('PINECONE_API_KEY not set — vector store is required for dedup.');
  }
  if (!indexPromise) {
    indexPromise = (async () => {
      const { Pinecone } = await import('@pinecone-database/pinecone');
      const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
      return pinecone.index(INDEX_NAME);
    })();
  }
  return indexPromise;
}

/**
 * Returns { isDuplicate, topScore } — true if a near-identical question already exists
 * in the vector store (cosine similarity above the configured threshold).
 */
export async function checkDuplicate(embedding) {
  const index = await getIndex();
  const result = await index.query({
    vector: embedding,
    topK: 1,
    includeMetadata: false,
  });

  const topScore = result.matches?.[0]?.score ?? 0;
  return { isDuplicate: topScore > THRESHOLD, topScore };
}

/** Upserts an accepted question's vector so future generations dedup against it too. */
export async function upsertQuestionVector(embedding, metadata) {
  const index = await getIndex();
  const vectorId = randomUUID();
  await index.upsert([{ id: vectorId, values: embedding, metadata }]);
  return vectorId;
}
