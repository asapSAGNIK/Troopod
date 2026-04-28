import { getVisionModel, withRetry } from "./gemini-client";
import { STRATEGY_PROMPT } from "./prompts";
import { strategyDecisionSchema } from "../validators/changes-schema";
import { AdAnalysis, PersonalizationResult, ScrapedPage, ChangeInstruction } from "../types";

// High-intent CTAs — never downgrade these
const HIGH_INTENT_CTAS = [
  "add to cart", "buy now", "shop now", "purchase",
  "order now", "get now", "grab now", "buy it now", "checkout"
];

// Low-intent CTAs — eligible for upgrade or Add To Cart injection
const LOW_INTENT_WORDS = [
  "learn more", "read more", "find out", "discover",
  "see more", "view details", "customize", "customise", "pre-order", "explore"
];

function isHighIntent(text: string): boolean {
  return HIGH_INTENT_CTAS.some(h => text.toLowerCase().includes(h));
}

function isLowIntent(text: string): boolean {
  return LOW_INTENT_WORDS.some(w => text.toLowerCase().includes(w));
}

export async function personalizeForAd(
  adAnalysis: AdAnalysis,
  scrapedPage: ScrapedPage
): Promise<PersonalizationResult> {
  const model = getVisionModel();
  const modifiableBlocks = scrapedPage.blocks.filter(b => b.isModifiable);

  // --- PHASE 1: APP PRE-CALCULATES ALL OVERLAY VALUES ---
  const offerText = adAnalysis.offer || "LIMITED TIME OFFER";

  // Countdown: 2 hours from now
  const targetDate = new Date();
  targetDate.setHours(targetDate.getHours() + 2);
  const targetIso = targetDate.toISOString();
  const pad = (n: number) => String(n).padStart(2, "0");

  // Urgency bar HTML (no script — script injected separately to avoid Cheerio mangling)
  const urgencyBarHtml = `<div data-tp-inject="urgency" style="background:#e11d48; color:#fff; text-align:center; padding:10px 20px; font-family:sans-serif; position:sticky; top:0; z-index:9999; display:flex; align-items:center; justify-content:center; gap:20px; box-shadow:0 2px 8px rgba(0,0,0,0.25);">
  <span style="font-weight:700; font-size:13px; letter-spacing:0.5px;">⚡ ${offerText}</span>
  <span style="display:inline-flex; align-items:flex-end; gap:6px;">
    <span style="text-align:center;"><span style="display:block; font-size:20px; font-weight:900; line-height:1;" id="tp-cd-h">${pad(2)}</span><span style="display:block; font-size:9px; opacity:0.75; letter-spacing:1px; margin-top:2px;">HRS</span></span>
    <span style="font-size:18px; font-weight:900; padding-bottom:10px; opacity:0.8;">:</span>
    <span style="text-align:center;"><span style="display:block; font-size:20px; font-weight:900; line-height:1;" id="tp-cd-m">${pad(0)}</span><span style="display:block; font-size:9px; opacity:0.75; letter-spacing:1px; margin-top:2px;">MINS</span></span>
    <span style="font-size:18px; font-weight:900; padding-bottom:10px; opacity:0.8;">:</span>
    <span style="text-align:center;"><span style="display:block; font-size:20px; font-weight:900; line-height:1;" id="tp-cd-s">${pad(0)}</span><span style="display:block; font-size:9px; opacity:0.75; letter-spacing:1px; margin-top:2px;">SECS</span></span>
  </span>
</div>`;

  const countdownScriptHtml = `<script data-tp-inject="cd-script">(function(){if(window.__tpTimer)clearInterval(window.__tpTimer);var e=new Date("${targetIso}");function t(){var n=new Date(),d=Math.max(0,e-n);var h=Math.floor(d/3600000),m=Math.floor((d%3600000)/60000),s=Math.floor((d%60000)/1000);var p=function(x){return String(x).padStart(2,"0");};var eh=document.getElementById("tp-cd-h"),em=document.getElementById("tp-cd-m"),es=document.getElementById("tp-cd-s");if(eh)eh.textContent=p(h);if(em)em.textContent=p(m);if(es)es.textContent=p(s);}t();window.__tpTimer=setInterval(t,1000);})()</script>`;

  // --- PHASE 2: FIND ANCHOR BLOCKS (deterministic, not AI) ---
  const bodyBlock = modifiableBlocks.find(b => b.id === "block-body");
  const headlineBlock = modifiableBlocks.find(b => b.type === "headline");
  const allPriceBlocks = modifiableBlocks.filter(b => b.type === "price");
  const isProductPage = allPriceBlocks.length > 0;
  const ctaBlock = modifiableBlocks.find(b => b.type === "cta");
  const ctaText = ctaBlock?.content || "";

  // Compute real discount % from page price blocks
  const extractNum = (text: string): number | null => {
    const match = text.replace(/,/g, "").match(/[\d.]+/);
    return match ? parseFloat(match[0]) : null;
  };
  const pagePrices = allPriceBlocks
    .map(b => extractNum(b.content))
    .filter((n): n is number => n !== null && n > 0);
  let offerChipLabel = "TODAY'S DEAL";
  if (pagePrices.length >= 2) {
    const maxPrice = Math.max(...pagePrices);
    const minPrice = Math.min(...pagePrices);
    if (maxPrice > minPrice) {
      const pct = Math.round(((maxPrice - minPrice) / maxPrice) * 100);
      // Only use non-zero, plausible discounts
      if (pct >= 5 && pct <= 95) offerChipLabel = `${pct}% OFF`;
    }
  }

  const offerChipHtml = `<div data-tp-inject="offer-chip" style="display:inline-flex; align-items:center; gap:6px; background:#e11d48; color:#fff; padding:8px 16px; border-radius:6px; font-size:14px; font-weight:800; margin-bottom:10px; letter-spacing:0.5px; box-shadow:0 2px 8px rgba(225,29,72,0.35);">🏷️ ${offerChipLabel} — Today Only</div><br>`;

  const addToCartBtnHtml = `<div data-tp-inject="cta-boost" style="margin-top:10px;"><button style="display:block; width:100%; background:#e11d48; color:#fff; border:none; padding:16px 20px; border-radius:8px; font-weight:700; font-size:16px; cursor:pointer; letter-spacing:0.5px; box-shadow:0 4px 12px rgba(225,29,72,0.4);">🛒 Add To Cart</button></div>`;

  console.log("Anchor blocks:", {
    body: !!bodyBlock, headline: !!headlineBlock,
    prices: allPriceBlocks.length, isProductPage,
    cta: ctaText || "none", hasTimer: scrapedPage.hasTimer,
  });

  // --- PHASE 3: AI STRATEGY DECISION (text + badge decisions only) ---
  const context = `
<ad_analysis>
- Headline: "${adAnalysis.headline}"
- Sub-headline: "${adAnalysis.subHeadline || "none"}"
- CTA: "${adAnalysis.cta}"
- Offer: "${adAnalysis.offer || "none"}"
- Tone: "${adAnalysis.tone}"
- Product/Service: "${adAnalysis.productOrService}"
- Key Benefits: ${JSON.stringify(adAnalysis.keyBenefits)}
- Target Audience: "${adAnalysis.targetAudience}"
</ad_analysis>

<page_context>
- Page Title: "${scrapedPage.title}"
- Current H1: "${headlineBlock?.content || "not found"}"
- Page Type: ${isProductPage ? "E-commerce/Product Page" : "Landing/Service Page"}
- Has Existing Countdown Timer: ${scrapedPage.hasTimer} ${scrapedPage.hasTimer ? "(DO NOT inject urgency — page already has one)" : "(safe to inject urgency bar)"}
- Current CTA: "${ctaText}" ${isHighIntent(ctaText) ? "[HIGH INTENT — return null for cta_upgrade]" : "[LOW INTENT — upgrade allowed]"}
</page_context>
`;

  const result = await withRetry(() =>
    model.generateContent([STRATEGY_PROMPT, context])
  );

  const responseText = result.response.text();
  const cleanedText = responseText
    .replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();

  const rawStrategy = JSON.parse(cleanedText);
  const strategy = strategyDecisionSchema.parse(rawStrategy);
  console.log("Strategy:", strategy);

  // --- PHASE 4: APP EXECUTES ALL CHANGES ---
  const changes: ChangeInstruction[] = [];

  // 1. Urgency bar — ONLY if page has no existing countdown
  if (!scrapedPage.hasTimer && strategy.inject_urgency && bodyBlock) {
    changes.push({
      blockId: "block-body", selector: "[data-tp-id='block-body']",
      action: "add_element", field: "prepend", originalValue: "",
      newValue: urgencyBarHtml,
      croRationale: "Urgency bar with live countdown adds time-pressure at top of viewport",
      confidence: 0.97, category: "urgency",
    });
    // Countdown script as separate change to avoid Cheerio script parsing issues
    changes.push({
      blockId: "block-body", selector: "[data-tp-id='block-body']",
      action: "add_element", field: "append", originalValue: "",
      newValue: countdownScriptHtml,
      croRationale: "Live countdown script ticks every second",
      confidence: 0.97, category: "urgency",
    });
  }

  // 2. Badge — AI picks the exact label (relevant to page type + ad claims)
  if (strategy.badge_label && headlineBlock) {
    const badgeBg = isProductPage ? "#f59e0b" : "#6366f1";
    const badgeHtml = `<div data-tp-inject="badge-label" style="display:inline-flex; align-items:center; gap:6px; background:${badgeBg}; color:#fff; padding:6px 14px; border-radius:6px; font-size:12px; font-weight:800; margin-bottom:10px; letter-spacing:0.6px; box-shadow:0 2px 6px rgba(0,0,0,0.2);">${strategy.badge_label}</div><br>`;
    changes.push({
      blockId: headlineBlock.id, selector: headlineBlock.selector,
      action: "add_element", field: "before", originalValue: "",
      newValue: badgeHtml,
      croRationale: `Badge "${strategy.badge_label}" creates immediate credibility signal matching ad claims`,
      confidence: 0.92, category: "social_proof",
    });
  }

  // 3. Bestseller badge — deterministic for product pages (has price = is product)
  if (isProductPage && headlineBlock && !strategy.badge_label) {
    // Only inject if AI didn't already supply a badge (avoid double badge)
    const bestsellerHtml = `<div data-tp-inject="badge-best" style="display:inline-flex; align-items:center; gap:6px; background:#f59e0b; color:#fff; padding:6px 14px; border-radius:6px; font-size:12px; font-weight:800; margin-bottom:10px; letter-spacing:0.6px; box-shadow:0 2px 6px rgba(245,158,11,0.4);">★ BESTSELLER</div><br>`;
    changes.push({
      blockId: headlineBlock.id, selector: headlineBlock.selector,
      action: "add_element", field: "before", originalValue: "",
      newValue: bestsellerHtml,
      croRationale: "Bestseller badge builds trust for product pages",
      confidence: 0.90, category: "social_proof",
    });
  }

  // 4. Headline rewrite — AI aligns H1 with ad message
  if (strategy.headline_rewrite && headlineBlock) {
    const originalHeadline = headlineBlock.content;
    // Safety: only rewrite if it's meaningfully different (>20% change)
    if (strategy.headline_rewrite.toLowerCase() !== originalHeadline.toLowerCase()) {
      changes.push({
        blockId: headlineBlock.id, selector: headlineBlock.selector,
        action: "replace_text", field: undefined,
        originalValue: originalHeadline,
        newValue: strategy.headline_rewrite,
        croRationale: "Headline rewritten to match ad's key message and hook the same visitor",
        confidence: 0.88, category: "message_match",
      });
    }
  }

  // 5. Offer chip — above the CTA, computed from real price data
  if (ctaBlock && isProductPage) {
    changes.push({
      blockId: ctaBlock.id, selector: ctaBlock.selector,
      action: "add_element", field: "before", originalValue: "",
      newValue: offerChipHtml,
      croRationale: `Discount badge (${offerChipLabel}) placed above CTA at the conversion decision point`,
      confidence: 0.94, category: "message_match",
    });
  }

  // 6. Add To Cart injection — only for low-intent CTAs on product pages
  if (ctaBlock && isProductPage && isLowIntent(ctaText) && !isHighIntent(ctaText)) {
    changes.push({
      blockId: ctaBlock.id, selector: ctaBlock.selector,
      action: "add_element", field: "after", originalValue: "",
      newValue: addToCartBtnHtml,
      croRationale: "High-intent Add To Cart button added after low-intent CTA to capture conversion",
      confidence: 0.95, category: "cta_alignment",
    });
  }

  // 7. CTA text upgrade — only for low-intent non-product pages
  if (strategy.cta_upgrade && ctaBlock && !isHighIntent(ctaText) && isLowIntent(ctaText)) {
    changes.push({
      blockId: ctaBlock.id, selector: ctaBlock.selector,
      action: "replace_text", field: undefined,
      originalValue: ctaText,
      newValue: strategy.cta_upgrade,
      croRationale: `CTA upgraded from "${ctaText}" to "${strategy.cta_upgrade}" for higher intent`,
      confidence: 0.88, category: "cta_alignment",
    });
  }

  console.log(`Executing ${changes.length} personalization changes.`);

  return {
    changes,
    summary: strategy.rationale,
    overallConfidence: strategy.confidence,
    warnings: changes.length === 0
      ? ["No anchor blocks detected — page structure may require review"]
      : [],
  };
}
