import { z } from "zod";

export const changeInstructionSchema = z.object({
  blockId: z.string().catch("unknown"),
  selector: z.string(),
  action: z.enum(["replace_text", "update_style", "replace_html", "add_element"]).catch("add_element"),
  field: z.string().optional(),
  originalValue: z.string().catch(""),
  newValue: z.string(),
  croRationale: z.string().catch("CRO optimization"),
  confidence: z.number().min(0).max(1).catch(0.7),
  category: z.enum([
    "message_match", "cta_alignment", "visual_continuity",
    "social_proof", "above_the_fold", "scent_trail", "urgency"
  ]).catch("message_match")
});

export const personalizationResultSchema = z.object({
  thinking: z.string().optional(),
  changes: z.array(changeInstructionSchema).catch([]),
  summary: z.string().catch("Personalization changes applied."),
  overallConfidence: z.number().min(0).max(1).catch(0.7),
  warnings: z.array(z.string()).catch([])
});

// New: Strategy-only schema — AI returns decisions, app executes overlays
export const strategyDecisionSchema = z.object({
  inject_urgency: z.boolean().catch(true),
  badge_type: z.enum(["bestseller", "price_drop"]).nullable().catch("bestseller"),
  inject_offer_chip: z.boolean().catch(false),
  inject_sticky_cta: z.boolean().catch(true),
  cta_upgrade: z.string().nullable().catch(null),
  rationale: z.string().catch("CRO overlays applied for message match."),
  confidence: z.number().min(0).max(1).catch(0.85),
});
