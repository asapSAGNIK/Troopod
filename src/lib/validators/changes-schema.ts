import { z } from "zod";

export const changeInstructionSchema = z.object({
  blockId: z.string().catch("unknown"),
  selector: z.string(),
  action: z.enum(["replace_text", "update_style", "replace_html", "add_element"]).catch("replace_text"),
  field: z.string().optional(),
  originalValue: z.string().catch(""),
  newValue: z.string(),
  croRationale: z.string().catch("CRO optimization"),
  confidence: z.number().min(0).max(1).catch(0.7),
  category: z.enum([
    "message_match", "cta_alignment", "visual_continuity", 
    "social_proof", "above_the_fold", "scent_trail"
  ]).catch("message_match")
});

export const personalizationResultSchema = z.object({
  changes: z.array(changeInstructionSchema).catch([]),
  summary: z.string().catch("Personalization changes applied."),
  overallConfidence: z.number().min(0).max(1).catch(0.7),
  warnings: z.array(z.string()).catch([])
});
