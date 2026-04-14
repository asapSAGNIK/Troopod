import { z } from "zod";

// Coerce null → sensible default so the pipeline never crashes on partial AI output
const nullableString = (fallback: string) =>
  z.string().nullable().transform((val) => val ?? fallback);

export const adAnalysisSchema = z.object({
  headline: nullableString("No headline detected"),
  subHeadline: z.string().nullable().default(null),
  cta: nullableString("Learn More"),
  offer: z.string().nullable().default(null),
  targetAudience: nullableString("General audience"),
  tone: z.enum([
    "urgent", "professional", "playful", "luxurious", 
    "friendly", "bold", "empathetic", "authoritative"
  ]).catch("professional"),
  emotionalAppeal: nullableString("Not determined"),
  colorPalette: z.array(z.string()).catch([]),
  productOrService: nullableString("Unknown product"),
  keyBenefits: z.array(z.string()).catch([]),
  confidence: z.number().min(0).max(1).catch(0.5)
});
