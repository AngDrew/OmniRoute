import { CORS_ORIGIN } from "@/shared/utils/cors";
import { handleChat } from "@/sse/handlers/chat";

export async function OPTIONS() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": CORS_ORIGIN,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  });
}

/**
 * POST /v1/response/:path* - legacy/singular alias of /v1/responses/:path*
 * Reuses shared chat handler to preserve passthrough behavior.
 */
export async function POST(request) {
  return await handleChat(request);
}
