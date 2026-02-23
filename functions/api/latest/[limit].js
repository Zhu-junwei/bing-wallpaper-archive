import { BASE_HEADERS, jsonResponse, loadImages } from "../../_lib/bing-api.js";

const MAX_LIMIT = 3650;

function parseLimit(text) {
  if (!/^\d+$/.test(text || "")) {
    return null;
  }
  const value = Number(text);
  if (!Number.isInteger(value) || value <= 0) {
    return null;
  }
  return Math.min(value, MAX_LIMIT);
}

export async function onRequest(context) {
  if (context.request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: BASE_HEADERS });
  }
  if (context.request.method !== "GET" && context.request.method !== "HEAD") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const limit = parseLimit(context.params.limit);
  if (!limit) {
    return jsonResponse({ error: "Invalid limit, expected positive integer." }, 400);
  }

  try {
    const images = await loadImages(context);
    return jsonResponse({ images: images.slice(0, limit) });
  } catch (error) {
    return jsonResponse(
      {
        error: "Failed to load wallpaper data",
        detail: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
}
