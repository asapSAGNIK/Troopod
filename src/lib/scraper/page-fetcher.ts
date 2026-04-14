import { chromium } from "playwright";

export async function fetchPageHtml(url: string): Promise<{ html: string; title: string }> {
  const browserlessToken = process.env.BROWSERLESS_TOKEN;
  let browser;

  if (browserlessToken) {
    console.log("Connecting to Browserless...");
    browser = await chromium.connectOverCDP(`wss://chrome.browserless.io?token=${browserlessToken}`);
  } else {
    browser = await chromium.launch({ headless: true });
  }
  try {
    const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });
    const page = await context.newPage();
    
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
    
    // Brief wait for JS frameworks to render content
    await page.waitForTimeout(2000);
    
    const html = await page.content();
    const title = await page.title();
    
    return { html, title };
  } finally {
    await browser.close();
  }
}
