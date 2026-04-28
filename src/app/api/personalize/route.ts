import { NextRequest, NextResponse } from "next/server";
import { analyzeAdCreative } from "@/lib/ai/ad-analyzer";
import { fetchPageHtml } from "@/lib/scraper/page-fetcher";
import { parsePageBlocks } from "@/lib/scraper/dom-parser";
import { personalizeForAd } from "@/lib/ai/personalizer";
import { applyChanges } from "@/lib/scraper/dom-modifier";
import { PersonalizeResponse } from "@/lib/types";

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  
  try {
    const formData = await req.formData();
    const adFile = formData.get("adFile") as File;
    const landingPageUrl = formData.get("landingPageUrl") as string;

    if (!adFile || !landingPageUrl) {
      return NextResponse.json({ error: "Missing ad file or landing page URL" }, { status: 400 });
    }

    // Phase 1 & 2: Ad Analysis & Page Scraping (Parallel)
    const adBuffer = Buffer.from(await adFile.arrayBuffer());
    const adAnalysisTask = analyzeAdCreative(adBuffer, adFile.type);
    const scrapingTask = fetchPageHtml(landingPageUrl);

    const [adAnalysis, { html: originalHtml, title }] = await Promise.all([
      adAnalysisTask,
      scrapingTask
    ]);
    
    const adAnalysisMs = Date.now() - startTime;
    const scrapingStartTime = Date.now();
    
    // Phase 3: Personalization
    const { blocks, modifiedHtml: htmlWithIds, hasTimer } = parsePageBlocks(originalHtml);
    console.log(`Parsed ${blocks.length} blocks. Has existing timer: ${hasTimer}`);
    
    const personalization = await personalizeForAd(adAnalysis, {
      url: landingPageUrl,
      title,
      fullHtml: htmlWithIds,
      blocks,
      hasTimer,
      meta: { hasForm: false, hasPricing: false, primaryColor: null }
    });
    
    console.log(`Generated ${personalization.changes.length} changes.`);
    
    const personalizationMs = Date.now() - scrapingStartTime;

    // Apply changes to the HTML that already has our deterministic IDs
    const modifiedHtml = applyChanges(htmlWithIds, personalization.changes);
    
    const totalMs = Date.now() - startTime;

    // Inject <base> tag so relative URLs resolve in iframes
    const baseTag = `<base href="${landingPageUrl}">`;
    const injectBase = (html: string) => {
      if (html.includes("<head>")) {
        return html.replace("<head>", `<head>${baseTag}`);
      }
      return `${baseTag}${html}`;
    };

    const response: PersonalizeResponse = {
      originalHtml: injectBase(originalHtml),
      modifiedHtml: injectBase(modifiedHtml),
      changes: personalization.changes,
      summary: personalization.summary,
      overallConfidence: personalization.overallConfidence,
      warnings: personalization.warnings,
      adAnalysis,
      processingTime: {
        adAnalysisMs,
        scrapingMs: 0, // Simplified for this demo
        personalizationMs,
        totalMs
      }
    };

    return NextResponse.json(response);

  } catch (error: any) {
    console.error("Personalization failed:", error);
    return NextResponse.json({ 
      error: "Failed to personalize page", 
      details: error.message 
    }, { status: 500 });
  }
}
