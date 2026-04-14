import { getVisionModel, withRetry } from "./gemini-client";
import { PERSONALIZER_PROMPT } from "./prompts";
import { personalizationResultSchema } from "../validators/changes-schema";
import { AdAnalysis, PersonalizationResult, ScrapedPage } from "../types";

export async function personalizeForAd(
  adAnalysis: AdAnalysis,
  scrapedPage: ScrapedPage
): Promise<PersonalizationResult> {
  const model = getVisionModel();
  
  // Filter for modifiable blocks to reduce token usage and noise
  const modifiableBlocks = scrapedPage.blocks.filter(b => b.isModifiable);

  const context = `
AD ANALYSIS:
${JSON.stringify(adAnalysis, null, 2)}

PAGE BLOCKS:
${JSON.stringify(modifiableBlocks, null, 2)}
`;

  const result = await withRetry(() =>
    model.generateContent([
      PERSONALIZER_PROMPT,
      context
    ])
  );

  const responseText = result.response.text();
  console.log("Personalizer response:", responseText);

  const cleanedText = responseText
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const rawData = JSON.parse(cleanedText);
  
  // Validate with Zod
  return personalizationResultSchema.parse(rawData) as PersonalizationResult;
}
