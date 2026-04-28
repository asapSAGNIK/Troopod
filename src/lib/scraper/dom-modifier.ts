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
          $el.text(change.newValue);
          break;
        case "replace_html":
          console.log(`APPLY: [${change.blockId}] replace_html`);
          $el.html(change.newValue);
          break;
        case "update_style":
          if (change.field) {
            console.log(`APPLY: [${change.blockId}] style ${change.field} = ${change.newValue}`);
            $el.css(change.field, change.newValue);
          }
          break;
        case "add_element":
          const position = change.field || "append";
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
