import { RetrievalResult } from "./retriever";

/**
 * Formats retrieved RAG documents into a prompt-injectable string.
 * Uses XML-style tags so the LLM can clearly distinguish RAG context from task instructions.
 */
export function buildRAGContext(retrieval: RetrievalResult): string {
  if (retrieval.croKnowledge.length === 0 && retrieval.pastCampaigns.length === 0) {
    return ""; // No RAG context available — fall back to base prompt
  }

  const sections: string[] = [];

  if (retrieval.croKnowledge.length > 0) {
    const studies = retrieval.croKnowledge
      .map((r, i) => `  ${i + 1}. [${r.metadata.source || "CRO Study"}] ${r.text}`)
      .join("\n");
    sections.push(`<cro_research>\n${studies}\n</cro_research>`);
  }

  if (retrieval.pastCampaigns.length > 0) {
    const campaigns = retrieval.pastCampaigns
      .map((r, i) => `  ${i + 1}. ${r.text}`)
      .join("\n");
    sections.push(`<past_campaigns>\n${campaigns}\n</past_campaigns>`);
  }

  return `
### GROUNDING CONTEXT (use these to inform your decisions):
${sections.join("\n\n")}
### END GROUNDING CONTEXT
`;
}
