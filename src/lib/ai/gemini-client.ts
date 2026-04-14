import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "@/config/env";

let genAI: GoogleGenerativeAI | null = null;

export const getGeminiClient = () => {
  if (!genAI) {
    genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
  }
  return genAI;
};

export const getVisionModel = () => {
  return getGeminiClient().getGenerativeModel({
    model: "gemini-2.5-flash-lite",
    generationConfig: { responseMimeType: "application/json" }
  });
};

/**
 * Retry wrapper for Gemini API calls.
 * Handles temporary 503 (overloaded) errors with exponential backoff.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelayMs = 2000
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      const isRetryable = error?.status === 503 || error?.status === 429;
      const isLastAttempt = attempt === maxRetries;

      if (!isRetryable || isLastAttempt) throw error;

      const delay = baseDelayMs * Math.pow(2, attempt);
      console.log(`Gemini API returned ${error.status}, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error("Retry logic failed unexpectedly");
}
