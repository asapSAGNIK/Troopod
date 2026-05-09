import { embedBatch } from "./embedder";
import { upsertVectors, VectorDocument } from "./vector-store";
import croCorpus from "./corpus/cro-knowledge.json";
import { TaskType } from "@google/generative-ai";

export async function ingestCROCorpus(): Promise<void> {
  console.log(`[RAG Ingest] Processing ${croCorpus.length} CRO knowledge chunks...`);

  const texts = croCorpus.map(entry => entry.text);
  const embeddings = await embedBatch(texts, TaskType.RETRIEVAL_DOCUMENT);

  const vectors: VectorDocument[] = croCorpus.map((entry, i) => ({
    id: entry.id,
    values: embeddings[i],
    metadata: {
      text: entry.text,
      category: entry.category as VectorDocument["metadata"]["category"],
      industry: entry.industry,
      source: entry.source,
    },
  }));

  await upsertVectors(vectors, "cro-knowledge");
  console.log(`[RAG Ingest] Done. ${vectors.length} vectors upserted.`);
}
