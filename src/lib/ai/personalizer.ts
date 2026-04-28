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

  // 1. PRE-CALCULATE OVERLAY MENU (Hydrate templates here, not in prompt)
  const brandColor = adAnalysis.colorPalette[0] || "#6366f1";
  const offerText = adAnalysis.offer || "SPECIAL OFFER";
  const discountText = adAnalysis.offer?.match(/\d+%/)?.[0] || "10%";

  // Dynamic countdown: 2 hours from now
  const targetDate = new Date();
  targetDate.setHours(targetDate.getHours() + 2);
  const timeStr = targetDate.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const overlayMenu = {
    urgency_bar: `<div data-tp-inject="urgency" style="background: ${brandColor}; color: #fff; text-align: center; padding: 10px 16px; font-weight: 700; font-family: sans-serif; position: sticky; top: 0; z-index: 9999; font-size: 13px; letter-spacing: 0.4px;">⚡ ${offerText} — ENDS IN ${timeStr}</div>`,
    bestseller_badge: `<span data-tp-inject="badge-best" style="display:inline-block; background:#f59e0b; color:#fff; padding:4px 10px; border-radius:4px; font-size:12px; font-weight:700; margin-bottom:8px; letter-spacing:0.5px;">★ BESTSELLER</span><br>`,
    price_drop_badge: `<span data-tp-inject="badge-drop" style="background:#ef4444; color:#fff; padding:4px 10px; border-radius:4px; font-size:12px; font-weight:700; margin-bottom:8px; margin-left:6px; letter-spacing:0.5px;">↓ PRICE DROP</span><br>`,
    offer_chip: `<span data-tp-inject="offer-chip" style="display:inline-block; background:#22c55e; color:#fff; padding:3px 10px; border-radius:12px; font-size:12px; font-weight:700; margin-left:8px; vertical-align:middle;">SAVE ${discountText}</span>`,
    sticky_cta: `<div data-tp-inject="sticky-cta" style="position:fixed; bottom:0; left:0; right:0; background:#fff; padding:12px 20px; box-shadow:0 -4px 20px rgba(0,0,0,0.15); z-index:9998; display:flex; justify-content:center;"><button onclick="window.scrollTo({top:0,behavior:'smooth'})" style="background:${brandColor}; color:#fff; border:none; padding:14px; border-radius:8px; font-weight:700; width:100%; font-size:16px; cursor:pointer; max-width:480px;">${adAnalysis.cta} →</button></div>`
  };

  // 2. FORMAT BLOCKS INTO A CLEAN ENUMERATED LIST (Anthropic/OpenAI Best Practice)
  const blockList = modifiableBlocks.map(b => 
    `• ${b.id} → type: ${b.type} | text: "${b.content.substring(0, 100)}${b.content.length > 100 ? '...' : ''}"`
  ).join('\n');

  const context = `
<ad_analysis>
${JSON.stringify(adAnalysis, null, 2)}
</ad_analysis>

<dynamic_context>
- Real Countdown Target: ${timeStr}
- Ad Tone: ${adAnalysis.tone}
- Primary Brand Color: ${brandColor}
</dynamic_context>

<overlay_menu>
${JSON.stringify(overlayMenu, null, 2)}
</overlay_menu>

<available_blocks>
${blockList}
</available_blocks>
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
