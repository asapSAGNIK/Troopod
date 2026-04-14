import { getVisionModel, withRetry } from "./gemini-client";
import { AD_ANALYZER_PROMPT } from "./prompts";
import { adAnalysisSchema } from "../validators/ad-schema";
import { AdAnalysis } from "../types";

export async function analyzeAdCreative(imageBuffer: Buffer, mimeType: string): Promise<AdAnalysis> {
  const model = getVisionModel();
  
  const result = await withRetry(() =>
    model.generateContent([
      AD_ANALYZER_PROMPT,
      {
        inlineData: {
          data: imageBuffer.toString("base64"),
          mimeType
        }
      }
    ])
  );

  const responseText = result.response.text();
  console.log("Raw Gemini response:", responseText);

  const cleanedText = responseText
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  let rawData: unknown;
  try {
    rawData = JSON.parse(cleanedText);
  } catch {
    throw new Error(`Gemini returned invalid JSON: ${cleanedText.substring(0, 200)}`);
  }

  console.log("Parsed data keys:", Object.keys(rawData as Record<string, unknown>));
  return adAnalysisSchema.parse(rawData) as AdAnalysis;
}
