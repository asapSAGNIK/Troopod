import { Pinecone } from "@pinecone-database/pinecone";

export interface VectorDocument {
  id: string;
  values: number[];
  metadata: {
    text: string;
    category: "cro_knowledge" | "campaign_history" | "industry_benchmark";
    industry?: string;
    pageType?: string;
    source?: string;
    confidence?: number;
  };
}

export interface SearchResult {
  id: string;
  score: number;
  text: string;
  metadata: VectorDocument["metadata"];
}

let pineconeClient: Pinecone | null = null;

function getClient(): Pinecone {
  if (!pineconeClient) {
    const apiKey = process.env.PINECONE_API_KEY;
    if (!apiKey) throw new Error("PINECONE_API_KEY is not set");
    pineconeClient = new Pinecone({ apiKey });
  }
  return pineconeClient;
}

function getIndex() {
  const indexName = process.env.PINECONE_INDEX || "troopod-rag";
  return getClient().index(indexName);
}

export async function upsertVectors(vectors: VectorDocument[], namespace: string): Promise<void> {
  if (vectors.length === 0) {
    console.warn("[Pinecone] upsertVectors called with empty array — skipping.");
    return;
  }

  const index = getIndex();
  const batchSize = 100;

  for (let i = 0; i < vectors.length; i += batchSize) {
    const batch = vectors.slice(i, i + batchSize).map(v => ({
      id: v.id,
      values: v.values,
      metadata: v.metadata,
    }));
    console.log(`[Pinecone] Upserting batch of ${batch.length} vectors to namespace "${namespace}"...`);
    await index.namespace(namespace).upsert({ records: batch } as any);
  }
}

export async function searchVectors(
  queryVector: number[],
  namespace: string,
  topK: number = 5,
  filter?: Record<string, any>
): Promise<SearchResult[]> {
  try {
    const index = getIndex();
    
    const results = await index.namespace(namespace).query({
      vector: queryVector,
      topK,
      includeMetadata: true,
      filter,
    });

    return (results.matches || []).map(match => ({
      id: match.id,
      score: match.score || 0,
      text: (match.metadata?.text as string) || "",
      metadata: match.metadata as VectorDocument["metadata"],
    }));
  } catch (error) {
    console.error(`[Pinecone Search Error] Namespace: ${namespace}`, error);
    return []; // Return empty results on failure (graceful degradation)
  }
}
