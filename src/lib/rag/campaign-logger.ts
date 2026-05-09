import { embedText } from "./embedder";
import { upsertVectors, VectorDocument } from "./vector-store";
import { AdAnalysis, ChangeInstruction } from "../types";
import { TaskType } from "@google/generative-ai";

export interface CampaignRecord {
  adAnalysis: AdAnalysis;
  pageType: string;
  pageUrl: string;
  industry?: string;
  changesApplied: ChangeInstruction[];
  overallConfidence: number;
  timestamp: string;
}

/**
 * Logs a completed campaign to the vector store for future retrieval.
 * This is the "learning loop" — every campaign makes future ones smarter.
 */
export async function logCampaign(record: CampaignRecord): Promise<void> {
  if (!process.env.PINECONE_API_KEY) {
      console.warn("PINECONE_API_KEY is not set. Skipping campaign logging.");
      return;
  }

  try {
    // Build a human-readable summary of what was done
    const changesSummary = record.changesApplied
      .map(c => `${c.category}: ${c.croRationale}`)
      .join("; ");

    const text = [
      `Page type: ${record.pageType}.`,
      record.industry ? `Industry: ${record.industry}.` : "",
      `Ad headline: "${record.adAnalysis.headline}".`,
      `Ad tone: ${record.adAnalysis.tone}.`,
      `Changes: ${changesSummary}.`,
      `Confidence: ${record.overallConfidence}.`,
    ].filter(Boolean).join(" ");

    const vector = await embedText(text, TaskType.RETRIEVAL_DOCUMENT);

    const doc: VectorDocument = {
      id: `campaign-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      values: vector,
      metadata: {
        text,
        category: "campaign_history",
        pageType: record.pageType,
        industry: record.industry,
        source: record.pageUrl,
        confidence: record.overallConfidence,
      },
    };

    await upsertVectors([doc], "campaigns");
    console.log(`[RAG] Campaign logged: ${doc.id}`);
  } catch (error) {
    console.error("[RAG] Failed to log campaign:", error);
  }
}
