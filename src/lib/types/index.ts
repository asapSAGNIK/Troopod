// ============================================================
// Shared Type Definitions — Troopod AI Personalization Engine
// ============================================================

// --- Ad Creative Analysis ---

export type AdTone =
  | "urgent"
  | "professional"
  | "playful"
  | "luxurious"
  | "friendly"
  | "bold"
  | "empathetic"
  | "authoritative";

export interface AdAnalysis {
  headline: string;
  subHeadline: string | null;
  cta: string;
  offer: string | null;
  targetAudience: string;
  tone: AdTone;
  emotionalAppeal: string;
  colorPalette: string[];
  productOrService: string;
  keyBenefits: string[];
  confidence: number;
}

// --- Page Scraping ---

export type PageBlockType =
  | "hero"
  | "headline"
  | "subheadline"
  | "cta"
  | "feature"
  | "testimonial"
  | "pricing"
  | "navigation"
  | "footer"
  | "image"
  | "section"
  | "announcement"
  | "price"
  | "reviews"
  | "product_image"
  | "badge_container"
  | "other";

export interface PageBlock {
  id: string;
  selector: string;
  type: PageBlockType;
  content: string;
  html: string;
  isModifiable: boolean;
  styles: Record<string, string>;
  order?: number;
}

export interface ScrapedPage {
  url: string;
  title: string;
  fullHtml: string;
  blocks: PageBlock[];
  meta: {
    hasForm: boolean;
    hasPricing: boolean;
    primaryColor: string | null;
  };
}

// --- CRO Personalization ---

export type ChangeAction =
  | "replace_text"
  | "update_style"
  | "replace_html"
  | "add_element";

export type ChangeCategory =
  | "message_match"
  | "cta_alignment"
  | "visual_continuity"
  | "social_proof"
  | "above_the_fold"
  | "scent_trail";

export interface ChangeInstruction {
  blockId: string;
  selector: string;
  action: ChangeAction;
  field?: string;
  originalValue: string;
  newValue: string;
  croRationale: string;
  confidence: number;
  category: ChangeCategory;
}

export interface PersonalizationResult {
  changes: ChangeInstruction[];
  summary: string;
  overallConfidence: number;
  warnings: string[];
}

// --- API Request/Response ---

export interface PersonalizeRequest {
  adImageUrl?: string;
  adImageBase64?: string;
  landingPageUrl: string;
}

export interface PersonalizeResponse {
  originalHtml: string;
  modifiedHtml: string;
  changes: ChangeInstruction[];
  summary: string;
  overallConfidence: number;
  warnings: string[];
  adAnalysis: AdAnalysis;
  processingTime: {
    adAnalysisMs: number;
    scrapingMs: number;
    personalizationMs: number;
    totalMs: number;
  };
}

export interface ApiError {
  error: string;
  details?: string;
  code: string;
}
