import { BASE_HEADERS, jsonResponse, loadImages } from "../_lib/bing-api.js";
import { pickRandomItems } from "../_lib/random-utils.js";

export async function onRequest(context) {
  if (context.request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: BASE_HEADERS });
  }
  if (context.request.method !== "GET" && context.request.method !== "HEAD") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const images = await loadImages(context);
    return jsonResponse({ images: pickRandomItems(images, 1) });
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
