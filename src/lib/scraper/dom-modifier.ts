import * as cheerio from "cheerio";
import { ChangeInstruction } from "../types";

export function applyChanges(
  originalHtml: string,
  changes: ChangeInstruction[]
): string {
  const $ = cheerio.load(originalHtml);

  console.log(`Applying ${changes.length} changes...`);

  for (const change of changes) {
    // Primary: deterministic data-tp-id lookup
    let $el = $(`[data-tp-id="${change.blockId}"]`);
    
    // Fallback: try the CSS selector
    if (!$el.length) {
      console.warn(`[data-tp-id="${change.blockId}"] not found. Trying selector: ${change.selector}`);
      $el = $(change.selector);
    }

    if (!$el.length) {
      console.warn(`SKIP: No element found for blockId="${change.blockId}" or selector="${change.selector}"`);
      continue;
    }

    try {
      switch (change.action) {
        case "replace_text":
          console.log(`APPLY: [${change.blockId}] replace_text → "${change.newValue.substring(0, 40)}..."`);
          // Only replace text if element is a leaf (no child elements) to avoid destroying inner HTML
          if ($el.children().length === 0) {
            $el.text(change.newValue);
          } else {
            // Replace only the first direct text node, preserving child elements (spans, icons, etc.)
            $el.contents().filter((_, el) => {
              // Cheerio nodes have a 'type' property; 'text' indicates a text node
              return (el as any).type === "text" || (el as any).nodeType === 3;
            }).first().replaceWith(change.newValue);
          }
          break;
        case "replace_html":
          // Disabled: we never want to fully replace existing HTML (overlay-only philosophy)
          console.warn(`SKIP: [${change.blockId}] replace_html is disabled to protect page identity.`);
          break;
        case "update_style":
          if (change.field) {
            console.log(`APPLY: [${change.blockId}] style ${change.field} = ${change.newValue}`);
            $el.css(change.field, change.newValue);
          }
          break;
        case "add_element":
          const position = change.field || "append";
          
          // Idempotency check: Don't inject if a similar overlay already exists
          const injectMatch = change.newValue.match(/data-tp-inject="([^"]+)"/);
          if (injectMatch) {
            const injectType = injectMatch[1];
            if ($el.parent().find(`[data-tp-inject="${injectType}"]`).length > 0) {
              console.log(`SKIP: [${change.blockId}] Overlay "${injectType}" already exists.`);
              continue;
            }
          }

          console.log(`APPLY: [${change.blockId}] add_element (${position})`);
          
          if (position === "before") {
            $el.before(change.newValue);
          } else if (position === "after") {
            $el.after(change.newValue);
          } else if (position === "prepend") {
            $el.prepend(change.newValue);
          } else {
            $el.append(change.newValue);
          }
          break;
      }
    } catch (err) {
      console.error(`FAIL: [${change.blockId}]:`, err);
    }
  }

  return $.html();
}
