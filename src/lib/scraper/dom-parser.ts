import * as cheerio from "cheerio";
import { PageBlock } from "../types";

export function parsePageBlocks(html: string): { blocks: PageBlock[], modifiedHtml: string, hasTimer: boolean } {
  const $ = cheerio.load(html);
  const blocks: PageBlock[] = [];
  const seen = new Set<any>();

  // Inject a body block first — allows urgency bar to be prepended to entire page
  const bodyEl = $("body").get(0);
  if (bodyEl) {
    const bodyId = "block-body";
    $(bodyEl).attr("data-tp-id", bodyId);
    blocks.push({
      id: bodyId,
      selector: `[data-tp-id="${bodyId}"]`,
      type: "other" as any,
      content: "page_wrapper_header_area",
      html: "<body>",
      isModifiable: true,
      styles: {},
    });
    seen.add(bodyEl);
  }

  // Helper: check if element is inside nav/header/footer
  const isInsideProtected = (el: any): boolean => {
    return $(el).parents("nav, header, footer").length > 0;
  };

  const addBlock = (el: any, type: string, modifiable: boolean) => {
    if (seen.has(el)) return;

    // Suppression: If a parent is already a block, don't add this child (prevents overlap)
    // Exception: If the child is a fundamentally different type (e.g., CTA inside a Hero)
    const protectedTypes = ["hero", "section", "announcement"];
    const hasProtectedParent = $(el).parents().toArray().some((parent: any) => {
        const parentId = $(parent).attr("data-tp-id");
        if (!parentId) return false;
        const parentBlock = blocks.find(b => b.id === parentId);
        return parentBlock && protectedTypes.includes(parentBlock.type);
    });

    if (hasProtectedParent && !["cta", "price", "reviews"].includes(type)) {
       return;
    }

    const id = `block-${blocks.length}`;
    $(el).attr("data-tp-id", id);
    
    blocks.push({
      id,
      selector: `[data-tp-id="${id}"]`,
      type: type as any,
      content: $(el).text().trim(),
      html: $(el).html() || "",
      isModifiable: modifiable,
      styles: {},
      order: blocks.length, // Track visual order
    });
    seen.add(el);
  };

  // 1. Announcement Bar (STRICT — only match elements explicitly labeled as announcement/promo bars)
  // WARNING: Do NOT use "first element" heuristic — it incorrectly marks Shopify root wrapper divs
  $("div, section, header, aside").each((i, el: any) => {
    const className = ($(el).attr("class") || "").toLowerCase();
    const id = ($(el).attr("id") || "").toLowerCase();
    if (/announcement|topbar|top-bar|notification-bar|promo-bar|alert-bar|site-notice/i.test(className + " " + id)) {
       addBlock(el, "announcement", true);
    }
  });

  // 2. Headlines
  $("h1, h2, h3, h4").each((i, el: any) => {
    const text = $(el).text().trim();
    if (!text || text.length < 2) return;
    addBlock(el, el.name === "h1" ? "headline" : "subheadline", !isInsideProtected(el));
  });

  // 3. Prices (Scoped)
  $("span, div, p, b, strong").each((i, el: any) => {
    const text = $(el).text().trim();
    const className = ($(el).attr("class") || "").toLowerCase();
    const currencySymbols = ["$", "€", "£", "₹", "¥"];
    
    // Fixed: correctly escaped regex for currency symbols
    const isCurrencyText = /^[$€£₹¥Rs.]+\s?[\d,.]+$/.test(text);
    const hasPriceClass = /price|amount|cost|current-price|money/i.test(className);

    if (isCurrencyText || (hasPriceClass && text.length < 25 && /\d/.test(text))) {
       addBlock(el, "price", true);
    }
  });

  // 4. Reviews/Ratings (Scoped)
  $("div, span, a, p").each((i, el: any) => {
    const text = $(el).text().trim();
    const className = ($(el).attr("class") || "").toLowerCase();
    if (/review|rating|star|feedback/i.test(className)) {
       if (text.length > 0 && text.length < 50) {
         addBlock(el, "reviews", true);
       }
    }
  });

  // 5. Product Images
  $("img").each((i, el: any) => {
    const className = ($(el).attr("class") || "").toLowerCase();
    const alt = ($(el).attr("alt") || "").toLowerCase();
    if (/product|main|hero|primary|featured/i.test(className + alt)) {
       addBlock(el, "product_image", true);
    }
  });

  // 6. Paragraphs/Features
  $("p").each((i, el: any) => {
    const text = $(el).text().trim();
    if (!text || text.length < 20 || text.length > 500 || isInsideProtected(el)) return;
    addBlock(el, "feature", true);
  });

  // 7. CTAs — broad detection to ensure CTA blocks always exist
  $("button, [role='button'], a").each((i, el: any) => {
    const text = $(el).text().trim();
    if (!text || text.length > 50 || text.length < 2 || isInsideProtected(el)) return;

    if (el.name === "a") {
      const className = ($(el).attr("class") || "").toLowerCase();
      const hasCtaClass = /btn|button|cta|action|shop|buy|order|signup|start/i.test(className);
      // Expanded: includes learn more, view, add to cart, customize, pre-order, explore
      const hasCtaText = /shop|buy|get|start|sign|order|download|try|learn|view|explore|add to|customize|pre-order|grab|claim|book|reserve/i.test(text);
      if (!hasCtaClass && !hasCtaText) return;
    }
    addBlock(el, "cta", true);
  });

  // 8. Hero
  $("section, div, [role='banner']").each((i, el: any) => {
    const className = ($(el).attr("class") || "").toLowerCase();
    const id = ($(el).attr("id") || "").toLowerCase();
    if (/hero|banner|jumbotron|masthead|splash|showcase|landing/i.test(className + " " + id)) {
      addBlock(el, "hero", true);
    }
  });

  // 9. Protected
  $("nav").each((i, el: any) => addBlock(el, "navigation", false));
  $("footer").each((i, el: any) => addBlock(el, "footer", false));

  // Detect existing countdown/timer elements — if found, skip urgency bar injection
  const timerSelectors = [
    "[class*='countdown']", "[class*='count-down']", "[class*='timer']",
    "[class*='flip-clock']", "[class*='flipclock']", "[id*='countdown']",
    "[id*='timer']", "[data-countdown]", "[data-timer]",
  ];
  const hasTimer = timerSelectors.some(sel => $(sel).length > 0);

  return { blocks, modifiedHtml: $.html(), hasTimer };
}


function getBestSelector($: any, el: any): string {
  const idValue = $(el).attr("id");
  if (idValue) return `#${idValue}`;

  const classValue = $(el).attr("class")?.split(" ")[0];
  if (classValue) return `${el.name}.${classValue}`;

  // Fallback: nth-of-type
  const tagName = el.name || "div";
  const index = $(el).index(tagName);
  return `${tagName}:nth-of-type(${index + 1})`;
}
