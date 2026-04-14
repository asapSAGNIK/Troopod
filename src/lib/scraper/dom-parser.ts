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

  // 1. Headlines
  $("h1, h2, h3, h4").each((i, el: any) => {
    const text = $(el).text().trim();
    if (!text || text.length < 2) return;
    addBlock(el, el.name === "h1" ? "headline" : "subheadline", !isInsideProtected(el));
  });

  // 2. Paragraphs
  $("p").each((i, el: any) => {
    const text = $(el).text().trim();
    if (!text || text.length < 20 || text.length > 500 || isInsideProtected(el)) return;
    addBlock(el, "feature", true);
  });

  // 3. CTAs
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

  // 4. Hero
  $("section, div, [role='banner']").each((i, el: any) => {
    const className = ($(el).attr("class") || "").toLowerCase();
    const id = ($(el).attr("id") || "").toLowerCase();
    if (/hero|banner|jumbotron|masthead|splash|showcase|landing/i.test(className + " " + id)) {
      addBlock(el, "hero", true);
    }
  });

  // 5. Protected
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
