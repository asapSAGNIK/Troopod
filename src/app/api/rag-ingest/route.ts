import { NextResponse } from "next/server";
import { ingestCROCorpus } from "@/lib/rag/ingest";

/**
 * POST /api/rag-ingest
 * One-time endpoint to seed the Pinecone index with the CRO knowledge corpus.
 * Protected by a secret token to prevent accidental/unauthorized re-seeding.
 *
 * Usage:
 *   curl -X POST http://localhost:3000/api/rag-ingest \
 *     -H "Authorization: Bearer YOUR_INGEST_SECRET"
 */
export async function POST(req: Request) {
  // Simple secret guard — set INGEST_SECRET in .env.local (any string you choose)
  const authHeader = req.headers.get("authorization");
  const secret = process.env.INGEST_SECRET;

  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.PINECONE_API_KEY) {
    return NextResponse.json(
      { error: "PINECONE_API_KEY is not set. Add it to .env.local first." },
      { status: 500 }
    );
  }

  try {
    console.log("[RAG Ingest] Starting corpus ingestion...");
    await ingestCROCorpus();
    return NextResponse.json({
      success: true,
      message: "CRO knowledge corpus successfully ingested into Pinecone.",
    });
  } catch (error: any) {
    console.error("[RAG Ingest] Failed:", error);
    return NextResponse.json(
      { error: "Ingestion failed", details: error.message },
      { status: 500 }
    );
  }
}
