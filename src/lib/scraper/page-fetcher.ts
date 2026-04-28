import { chromium } from "playwright-core";

const SCRAPE_CACHE = new Map<string, { html: string; title: string; timestamp: number }>();
const CACHE_TTL = 1 * 60 * 1000; // 1 minute

export async function fetchPageHtml(url: string): Promise<{ html: string; title: string }> {
  // Check cache first
  const cached = SCRAPE_CACHE.get(url);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`CACHE HIT: Returning cached HTML for ${url}`);
    return { html: cached.html, title: cached.title };
  }

  const browserlessToken = process.env.BROWSERLESS_TOKEN;
  let browser;

  if (browserlessToken) {
    console.log("Connecting to Browserless...");
    browser = await chromium.connectOverCDP(`wss://chrome.browserless.io?token=${browserlessToken}`);
  } else {
    throw new Error("CRITICAL: BROWSERLESS_TOKEN is undefined! Please check your Vercel Environment Variables.");
  }

  try {
    const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });
    const page = await context.newPage();
    
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
    await page.waitForTimeout(2000);
    
    const html = await page.content();
    const title = await page.title();
    
    // Update cache
    SCRAPE_CACHE.set(url, { html, title, timestamp: Date.now() });
    
    return { html, title };
  } finally {
    await browser.close();
  }
}
