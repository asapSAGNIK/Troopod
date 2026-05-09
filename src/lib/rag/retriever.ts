import { embedText } from "./embedder";
import { searchVectors, SearchResult } from "./vector-store";
import { TaskType } from "@google/generative-ai";

export interface RetrievalRequest {
  pageType: string;       // "ecommerce", "saas", "lead-gen"
  industry?: string;      // "fashion", "tech", "supplements"
  adTone?: string;        // from AdAnalysis.tone
  currentHeadline?: string;
}

export interface RetrievalResult {
  croKnowledge: SearchResult[];
  pastCampaigns: SearchResult[];
  totalTokensUsed: number;
}

const MAX_RAG_TOKENS = 1500; // Hard cap — never exceed this
const APPROX_CHARS_PER_TOKEN = 4;

export async function retrieveContext(request: RetrievalRequest): Promise<RetrievalResult> {
  if (!process.env.PINECONE_API_KEY) {
      console.warn("PINECONE_API_KEY is not set. Skipping RAG retrieval.");
      return { croKnowledge: [], pastCampaigns: [], totalTokensUsed: 0 };
  }

  // Build a semantic query from the request
  const query = [
    `CRO optimization for ${request.pageType} page`,
    request.industry ? `in ${request.industry} industry` : "",
    request.adTone ? `with ${request.adTone} tone` : "",
    request.currentHeadline ? `current headline: ${request.currentHeadline}` : "",
  ].filter(Boolean).join(", ");

  const queryVector = await embedText(query, TaskType.RETRIEVAL_QUERY);

  // Search both namespaces in parallel
  const [croResults, campaignResults] = await Promise.all([
    searchVectors(queryVector, "cro-knowledge", 3, 
      request.industry ? { industry: request.industry } : undefined
    ),
    searchVectors(queryVector, "campaigns", 3,
      request.pageType ? { pageType: request.pageType } : undefined
    ),
  ]);

  // Trim to fit token budget
  const allResults = [...croResults, ...campaignResults];
  let tokenCount = 0;
  const trimmed: { cro: SearchResult[]; campaigns: SearchResult[] } = { cro: [], campaigns: [] };

  for (const result of croResults) {
    const tokens = Math.ceil(result.text.length / APPROX_CHARS_PER_TOKEN);
    if (tokenCount + tokens > MAX_RAG_TOKENS) break;
    trimmed.cro.push(result);
    tokenCount += tokens;
  }

  for (const result of campaignResults) {
    const tokens = Math.ceil(result.text.length / APPROX_CHARS_PER_TOKEN);
    if (tokenCount + tokens > MAX_RAG_TOKENS) break;
    trimmed.campaigns.push(result);
    tokenCount += tokens;
  }

  return {
    croKnowledge: trimmed.cro,
    pastCampaigns: trimmed.campaigns,
    totalTokensUsed: tokenCount,
  };
}
