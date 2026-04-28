import { getVisionModel, withRetry } from "./gemini-client";
import { STRATEGY_PROMPT } from "./prompts";
import { strategyDecisionSchema } from "../validators/changes-schema";
import { AdAnalysis, PersonalizationResult, ScrapedPage, ChangeInstruction } from "../types";

// High-intent CTAs — never downgrade these
const HIGH_INTENT_CTAS = [
  "add to cart", "buy now", "shop now", "purchase",
  "order now", "get now", "grab now", "buy it now", "checkout"
];

function isHighIntent(ctaText: string): boolean {
  return HIGH_INTENT_CTAS.some(h => ctaText.toLowerCase().includes(h));
}

export async function personalizeForAd(
  adAnalysis: AdAnalysis,
  scrapedPage: ScrapedPage
): Promise<PersonalizationResult> {
  const model = getVisionModel();

  // Filter for modifiable blocks
  const modifiableBlocks = scrapedPage.blocks.filter(b => b.isModifiable);

  // --- PHASE 1: APP OWNS THE DATA (pre-calculate all overlay values) ---
  const brandColor = adAnalysis.colorPalette[0] || "#6366f1";
  const offerText = adAnalysis.offer || "LIMITED OFFER";
  const discountText = adAnalysis.offer?.match(/\d+%/)?.[0] || "SAVE NOW";

  const targetDate = new Date();
  targetDate.setHours(targetDate.getHours() + 2);
  const timeStr = targetDate.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  // Pre-hydrated HTML overlays — no AI guesswork on values
  const overlayMenu = {
    urgency_bar: `<div data-tp-inject="urgency" style="background: ${brandColor}; color: #fff; text-align: center; padding: 10px 16px; font-weight: 700; font-family: sans-serif; position: sticky; top: 0; z-index: 9999; font-size: 13px; letter-spacing: 0.4px;">⚡ ${offerText} — ENDS IN ${timeStr}</div>`,
    bestseller_badge: `<span data-tp-inject="badge-best" style="display:inline-block; background:#f59e0b; color:#fff; padding:4px 10px; border-radius:4px; font-size:12px; font-weight:700; margin-bottom:8px; letter-spacing:0.5px;">★ BESTSELLER</span><br>`,
    price_drop_badge: `<span data-tp-inject="badge-drop" style="display:inline-block; background:#ef4444; color:#fff; padding:4px 10px; border-radius:4px; font-size:12px; font-weight:700; margin-bottom:8px; letter-spacing:0.5px;">↓ PRICE DROP</span><br>`,
    offer_chip: `<span data-tp-inject="offer-chip" style="display:inline-block; background:#22c55e; color:#fff; padding:3px 10px; border-radius:12px; font-size:12px; font-weight:700; margin-left:8px; vertical-align:middle;">${discountText}</span>`,
    sticky_cta: `<div data-tp-inject="sticky-cta" style="position:fixed; bottom:0; left:0; right:0; background:#fff; padding:12px 20px; box-shadow:0 -4px 20px rgba(0,0,0,0.15); z-index:9998; display:flex; justify-content:center;"><button onclick="window.scrollTo({top:0,behavior:'smooth'})" style="background:${brandColor}; color:#fff; border:none; padding:14px; border-radius:8px; font-weight:700; width:100%; font-size:16px; cursor:pointer; max-width:480px;">${adAnalysis.cta || "Shop Now"} →</button></div>`
  };

  // --- PHASE 2: FIND ANCHOR BLOCKS (app logic, deterministic) ---
  const bodyBlock = modifiableBlocks.find(b => b.id === "block-body");
  const headlineBlock = modifiableBlocks.find(b => b.type === "headline");
  const priceBlock = modifiableBlocks.find(b => b.type === "price");
  const ctaBlock = modifiableBlocks.find(b => b.type === "cta");
  const ctaText = ctaBlock?.content || "";

  // --- PHASE 3: AI MAKES STRATEGY DECISION ONLY (simple JSON, no DOM) ---
  const context = `
<ad_analysis>
- Headline: "${adAnalysis.headline}"
- CTA: "${adAnalysis.cta}"
- Offer: "${adAnalysis.offer || "none"}"
- Tone: "${adAnalysis.tone}"
- Key Benefits: ${JSON.stringify(adAnalysis.keyBenefits)}
- Emotional Appeal: "${adAnalysis.emotionalAppeal}"
</ad_analysis>

<page_context>
- Page Headline: "${headlineBlock?.content || "not found"}"
- Current CTA Text: "${ctaText}" ${isHighIntent(ctaText) ? "[HIGH INTENT — return null for cta_upgrade]" : "[LOW INTENT — upgrade allowed]"}
- Has Price Block: ${priceBlock ? "yes" : "no"}
- Has Reviews Block: ${modifiableBlocks.some(b => b.type === "reviews") ? "yes" : "no"}
</page_context>
`;

  const result = await withRetry(() =>
    model.generateContent([STRATEGY_PROMPT, context])
  );

  const responseText = result.response.text();
  console.log("Strategy decision raw:", responseText);

  const cleanedText = responseText
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const rawStrategy = JSON.parse(cleanedText);
  const strategy = strategyDecisionSchema.parse(rawStrategy);
  console.log("Strategy parsed:", strategy);

  // --- PHASE 4: APPLICATION EXECUTES OVERLAYS (deterministic, no AI) ---
  const changes: ChangeInstruction[] = [];

  // 1. Urgency bar — top of page
  if (strategy.inject_urgency && bodyBlock) {
    changes.push({
      blockId: "block-body",
      selector: "[data-tp-id='block-body']",
      action: "add_element",
      field: "prepend",
      originalValue: "",
      newValue: overlayMenu.urgency_bar,
      croRationale: "Urgency bar reinforces ad offer and creates time pressure at the top of the viewport",
      confidence: 0.97,
      category: "urgency",
    });
  }

  // 2. Badge above headline
  if (strategy.badge_type && headlineBlock) {
    const badge = strategy.badge_type === "bestseller"
      ? overlayMenu.bestseller_badge
      : overlayMenu.price_drop_badge;
    changes.push({
      blockId: headlineBlock.id,
      selector: headlineBlock.selector,
      action: "add_element",
      field: "before",
      originalValue: "",
      newValue: badge,
      croRationale: "Badge creates social proof scent trail matching ad's credibility signals",
      confidence: 0.92,
      category: "social_proof",
    });
  }

  // 3. Offer chip next to price
  if (strategy.inject_offer_chip && priceBlock) {
    changes.push({
      blockId: priceBlock.id,
      selector: priceBlock.selector,
      action: "add_element",
      field: "after",
      originalValue: "",
      newValue: overlayMenu.offer_chip,
      croRationale: "Offer chip highlights savings to amplify the ad's deal messaging at the price anchor",
      confidence: 0.90,
      category: "message_match",
    });
  }

  // 4. CTA upgrade — only if page CTA is low intent
  if (strategy.cta_upgrade && ctaBlock && !isHighIntent(ctaText)) {
    changes.push({
      blockId: ctaBlock.id,
      selector: ctaBlock.selector,
      action: "replace_text",
      originalValue: ctaText,
      newValue: strategy.cta_upgrade,
      croRationale: "CTA text upgraded to match ad's higher-intent action language",
      confidence: 0.88,
      category: "cta_alignment",
    });
  }

  // 5. Sticky CTA — always at bottom
  if (strategy.inject_sticky_cta && bodyBlock) {
    changes.push({
      blockId: "block-body",
      selector: "[data-tp-id='block-body']",
      action: "add_element",
      field: "append",
      originalValue: "",
      newValue: overlayMenu.sticky_cta,
      croRationale: "Sticky CTA ensures conversion opportunity is always visible, especially on mobile",
      confidence: 0.97,
      category: "above_the_fold",
    });
  }

  console.log(`Applied ${changes.length} overlay changes.`);

  return {
    changes,
    summary: strategy.rationale,
    overallConfidence: strategy.confidence,
    warnings: changes.length === 0
      ? ["No anchor blocks found — page structure may require manual review"]
      : [],
  };
}
