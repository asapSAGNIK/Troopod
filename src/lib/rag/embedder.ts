import { TaskType } from "@google/generative-ai";

const JINA_EMBED_URL = "https://api.jina.ai/v1/embeddings";
const JINA_MODEL = "jina-embeddings-v2-base-en"; // 768-dim, matches Pinecone index
export const EMBEDDING_DIMENSION = 768;

// Map Google TaskType to Jina task strings
function toJinaTask(taskType: TaskType): string {
  switch (taskType) {
    case TaskType.RETRIEVAL_DOCUMENT: return "retrieval.passage";
    case TaskType.RETRIEVAL_QUERY:    return "retrieval.query";
    default:                          return "retrieval.query";
  }
}

export async function embedText(
  text: string,
  taskType: TaskType = TaskType.RETRIEVAL_QUERY
): Promise<number[]> {
  const apiKey = process.env.JINA_API_KEY;
  if (!apiKey) throw new Error("JINA_API_KEY is not set");

  const response = await fetch(JINA_EMBED_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: JINA_MODEL,
      task: toJinaTask(taskType),
      input: [text],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Jina embed failed (${response.status}): ${err}`);
  }

  const data = await response.json();
  return data.data[0].embedding as number[];
}

export async function embedBatch(
  texts: string[],
  taskType: TaskType = TaskType.RETRIEVAL_DOCUMENT
): Promise<number[][]> {
  const apiKey = process.env.JINA_API_KEY;
  if (!apiKey) throw new Error("JINA_API_KEY is not set");

  // Jina supports batching natively — send all at once (max 2048 per request)
  const batchSize = 100;
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);

    const response = await fetch(JINA_EMBED_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: JINA_MODEL,
        task: toJinaTask(taskType),
        input: batch,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Jina batch embed failed (${response.status}): ${err}`);
    }

    const data = await response.json();
    const embeddings = data.data.map((d: any) => d.embedding as number[]);
    results.push(...embeddings);
  }

  return results;
}
