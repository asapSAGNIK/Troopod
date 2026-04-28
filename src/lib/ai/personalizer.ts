import { getVisionModel, withRetry } from "./gemini-client";
import { STRATEGY_PROMPT } from "./prompts";
import { strategyDecisionSchema } from "../validators/changes-schema";
import { AdAnalysis, PersonalizationResult, ScrapedPage, ChangeInstruction } from "../types";

// High-intent CTAs — never downgrade these
const HIGH_INTENT_CTAS = [
  "add to cart", "buy now", "shop now", "purchase",
  "order now", "get now", "grab now", "buy it now", "checkout"
];

// Low-intent CTAs — a "Add To Cart" injection makes sense here
const LOW_INTENT_WORDS = [
  "learn more", "read more", "find out", "discover",
  "see more", "view details", "customize", "customise", "pre-order"
];

function isHighIntent(ctaText: string): boolean {
  return HIGH_INTENT_CTAS.some(h => ctaText.toLowerCase().includes(h));
}

function isLowIntent(ctaText: string): boolean {
  return LOW_INTENT_WORDS.some(w => ctaText.toLowerCase().includes(w));
}

export async function personalizeForAd(
  adAnalysis: AdAnalysis,
  scrapedPage: ScrapedPage
): Promise<PersonalizationResult> {
  const model = getVisionModel();

  const modifiableBlocks = scrapedPage.blocks.filter(b => b.isModifiable);

  // --- PHASE 1: PRE-CALCULATE OVERLAY VALUES ---
  const offerText = adAnalysis.offer || "LIMITED TIME OFFER";
  // Extract discount % from offer text, or compute from price blocks if possible
  const discountMatch = adAnalysis.offer?.match(/(\d+)%/);
  const discountPct = discountMatch?.[1] || null;
  const discountLabel = discountPct ? `${discountPct}% OFF` : "DEAL";

  // Countdown: 2 hours from now
  const targetDate = new Date();
  targetDate.setHours(targetDate.getHours() + 2);
  const targetIso = targetDate.toISOString();

  // Pre-rendered initial countdown values
  const pad = (n: number) => String(n).padStart(2, "0");
  const initH = pad(2), initM = pad(0), initS = pad(0);

  // --- OVERLAY MENU ---
  const overlayMenu = {
    // Urgency bar: RED always — no brand color (CRO best practice: red = urgency)
    // NO <script> here — countdown injected as a separate change to avoid Cheerio mangling
    urgency_bar: `<div data-tp-inject="urgency" style="background:#e11d48; color:#fff; text-align:center; padding:10px 20px; font-family:sans-serif; position:sticky; top:0; z-index:9999; display:flex; align-items:center; justify-content:center; gap:20px; box-shadow:0 2px 8px rgba(0,0,0,0.25);">
  <span style="font-weight:700; font-size:13px; letter-spacing:0.5px;">⚡ ${offerText}</span>
  <span style="display:inline-flex; align-items:flex-end; gap:6px;">
    <span style="text-align:center;"><span style="display:block; font-size:20px; font-weight:900; line-height:1;" id="tp-cd-h">${initH}</span><span style="display:block; font-size:9px; opacity:0.75; letter-spacing:1px; margin-top:2px;">HRS</span></span>
    <span style="font-size:18px; font-weight:900; padding-bottom:10px; opacity:0.8;">:</span>
    <span style="text-align:center;"><span style="display:block; font-size:20px; font-weight:900; line-height:1;" id="tp-cd-m">${initM}</span><span style="display:block; font-size:9px; opacity:0.75; letter-spacing:1px; margin-top:2px;">MINS</span></span>
    <span style="font-size:18px; font-weight:900; padding-bottom:10px; opacity:0.8;">:</span>
    <span style="text-align:center;"><span style="display:block; font-size:20px; font-weight:900; line-height:1;" id="tp-cd-s">${initS}</span><span style="display:block; font-size:9px; opacity:0.75; letter-spacing:1px; margin-top:2px;">SECS</span></span>
  </span>
</div>`,

    // Countdown script — injected SEPARATELY to avoid Cheerio HTML parsing issues
    countdown_script: `<script data-tp-inject="cd-script">(function(){if(window.__tpTimer)clearInterval(window.__tpTimer);var e=new Date("${targetIso}");function t(){var n=new Date(),d=Math.max(0,e-n);var h=Math.floor(d/3600000),m=Math.floor((d%3600000)/60000),s=Math.floor((d%60000)/1000);var p=function(x){return String(x).padStart(2,"0");};var eh=document.getElementById("tp-cd-h"),em=document.getElementById("tp-cd-m"),es=document.getElementById("tp-cd-s");if(eh)eh.textContent=p(h);if(em)em.textContent=p(m);if(es)es.textContent=p(s);}t();window.__tpTimer=setInterval(t,1000);})()</script>`,

    // Badge — bold pill above the headline
    bestseller_badge: `<div data-tp-inject="badge-best" style="display:inline-flex; align-items:center; gap:6px; background:#f59e0b; color:#fff; padding:6px 14px; border-radius:6px; font-size:12px; font-weight:800; margin-bottom:10px; letter-spacing:0.6px; box-shadow:0 2px 6px rgba(245,158,11,0.4);">★ BESTSELLER</div><br>`,
    price_drop_badge: `<div data-tp-inject="badge-drop" style="display:inline-flex; align-items:center; gap:6px; background:#ef4444; color:#fff; padding:6px 14px; border-radius:6px; font-size:12px; font-weight:800; margin-bottom:10px; letter-spacing:0.6px; box-shadow:0 2px 6px rgba(239,68,68,0.4);">↓ PRICE DROP</div><br>`,

    // Offer chip — prominent red badge next to price (like "36% OFF" in rabitat)
    offer_chip: `<span data-tp-inject="offer-chip" style="display:inline-block; background:#e11d48; color:#fff; padding:4px 12px; border-radius:4px; font-size:13px; font-weight:800; margin-left:10px; vertical-align:middle; letter-spacing:0.5px;">${discountLabel}</span>`,

    // Add To Cart button — injected AFTER a low-intent CTA (like "Customise" or "Pre-Order")
    add_to_cart_btn: `<div data-tp-inject="cta-boost" style="margin-top:10px;"><button style="display:block; width:100%; background:#e11d48; color:#fff; border:none; padding:16px 20px; border-radius:8px; font-weight:700; font-size:16px; cursor:pointer; letter-spacing:0.5px; box-shadow:0 4px 12px rgba(225,29,72,0.4);">🛒 Add To Cart</button></div>`,
  };

  // --- PHASE 2: FIND ANCHOR BLOCKS ---
  const bodyBlock = modifiableBlocks.find(b => b.id === "block-body");
  const headlineBlock = modifiableBlocks.find(b => b.type === "headline");
  const priceBlock = modifiableBlocks.find(b => b.type === "price");
  const ctaBlock = modifiableBlocks.find(b => b.type === "cta");
  const ctaText = ctaBlock?.content || "";

  console.log("Anchor blocks found:", {
    body: !!bodyBlock,
    headline: !!headlineBlock,
    price: !!priceBlock,
    cta: ctaText || "none",
  });

  // --- PHASE 3: AI STRATEGY DECISION ---
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

  // --- PHASE 4: APPLICATION EXECUTES OVERLAYS ---
  const changes: ChangeInstruction[] = [];

  // 1. Urgency bar — top of page (always fire if body block exists)
  if (bodyBlock) {
    changes.push({
      blockId: "block-body",
      selector: "[data-tp-id='block-body']",
      action: "add_element",
      field: "prepend",
      originalValue: "",
      newValue: overlayMenu.urgency_bar,
      croRationale: "Urgency bar with live countdown creates time pressure at the very top of the viewport",
      confidence: 0.97,
      category: "urgency",
    });

    // 2. Countdown script — separate change, appended to body to avoid Cheerio script parsing issues
    changes.push({
      blockId: "block-body",
      selector: "[data-tp-id='block-body']",
      action: "add_element",
      field: "append",
      originalValue: "",
      newValue: overlayMenu.countdown_script,
      croRationale: "Live countdown script updates the timer every second",
      confidence: 0.97,
      category: "urgency",
    });
  }

  // 3. Badge above headline
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
      croRationale: "Badge creates immediate social proof scent trail matching ad credibility signals",
      confidence: 0.92,
      category: "social_proof",
    });
  }

  // 4. Offer chip next to price
  if (priceBlock) {
    changes.push({
      blockId: priceBlock.id,
      selector: priceBlock.selector,
      action: "add_element",
      field: "after",
      originalValue: "",
      newValue: overlayMenu.offer_chip,
      croRationale: "Prominent discount badge next to price anchors the deal and amplifies urgency",
      confidence: 0.92,
      category: "message_match",
    });
  }

  // 5. "Add To Cart" button — injected after a low-intent CTA (e.g. "Customise", "Pre-Order")
  if (ctaBlock && isLowIntent(ctaText)) {
    changes.push({
      blockId: ctaBlock.id,
      selector: ctaBlock.selector,
      action: "add_element",
      field: "after",
      originalValue: "",
      newValue: overlayMenu.add_to_cart_btn,
      croRationale: "High-intent 'Add To Cart' button added below low-intent CTA to drive direct conversion",
      confidence: 0.95,
      category: "cta_alignment",
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
