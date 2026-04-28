import * as cheerio from "cheerio";
import { PageBlock } from "../types";

export function parsePageBlocks(html: string): { blocks: PageBlock[], modifiedHtml: string } {
  const $ = cheerio.load(html);
  const blocks: PageBlock[] = [];
  const seen = new Set<any>();

  // Helper: check if element is inside nav/header/footer
  const isInsideProtected = (el: any): boolean => {
    return $(el).parents("nav, header, footer").length > 0;
  };

  const addBlock = (el: any, type: string, modifiable: boolean) => {
    if (seen.has(el)) return;
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
    });
    seen.add(el);
  };

  // 1. Announcement Bar (heuristic: top fixed/absolute, or first div with text)
  $("div, section, header").first().each((i, el: any) => {
    const text = $(el).text().trim();
    const className = ($(el).attr("class") || "").toLowerCase();
    const id = ($(el).attr("id") || "").toLowerCase();
    if (/announcement|topbar|notification|promo|alert/i.test(className + id) || (text.length > 0 && text.length < 100 && i === 0)) {
       addBlock(el, "announcement", true);
    }
  });

  // 2. Headlines
  $("h1, h2, h3, h4").each((i, el: any) => {
    const text = $(el).text().trim();
    if (!text || text.length < 2) return;
    addBlock(el, el.name === "h1" ? "headline" : "subheadline", !isInsideProtected(el));
  });

  // 3. Prices
  $("*").each((i, el: any) => {
    const text = $(el).text().trim();
    // Heuristic for price: starts with currency symbol, followed by numbers
    if (/^[\\$€£₹¥]\\s?\\d+([.,]\\d{2})?$/.test(text)) {
      addBlock(el, "price", true);
    }
    // Also check classes
    const className = ($(el).attr("class") || "").toLowerCase();
    const currencySymbols = ["$", "€", "£", "₹", "¥"];
    if (/price|amount|cost/i.test(className) && text.length < 20 && currencySymbols.some(sym => text.includes(sym))) {
       addBlock(el, "price", true);
    }
  });

  // 4. Reviews/Ratings
  $("*").each((i, el: any) => {
    const text = $(el).text().trim();
    const className = ($(el).attr("class") || "").toLowerCase();
    if (/review|rating|star|feedback/i.test(className + " " + text.toLowerCase())) {
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

  // 7. CTAs
  $("button, [role='button'], a").each((i, el: any) => {
    const text = $(el).text().trim();
    if (!text || text.length > 40 || text.length < 2 || isInsideProtected(el)) return;

    if (el.name === "a") {
      const className = ($(el).attr("class") || "").toLowerCase();
      const hasCtaClass = /btn|button|cta|action|shop|buy|order|signup|start/i.test(className);
      const hasCtaText = /shop|buy|get|start|sign|order|download|try|learn|view|explore|add to/i.test(text);
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

  return { blocks, modifiedHtml: $.html() };
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
