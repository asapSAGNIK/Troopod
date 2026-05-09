import { z } from "zod";

/**
 * Typed, validated environment variable access.
 * Single source of truth — import from here, never read process.env directly.
 * Throws at startup if required vars are missing.
 */
const envSchema = z.object({
  GEMINI_API_KEY: z.string().min(1, "GEMINI_API_KEY is required"),
  PINECONE_API_KEY: z.string().optional(),
  PINECONE_INDEX: z.string().default("troopod-rag"),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
});

export const env = envSchema.parse({
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  PINECONE_API_KEY: process.env.PINECONE_API_KEY,
  PINECONE_INDEX: process.env.PINECONE_INDEX,
  NODE_ENV: process.env.NODE_ENV,
});

