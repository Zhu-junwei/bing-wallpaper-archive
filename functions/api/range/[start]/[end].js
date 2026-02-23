import { BASE_HEADERS, jsonResponse, loadImages } from "../../../_lib/bing-api.js";

function normalizeDateKey(text) {
  if (typeof text !== "string") {
    return null;
  }
  const value = text.trim();
  if (/^\d{8}$/.test(value)) {
    return value;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value.replaceAll("-", "");
  }
  return null;
}

export async function onRequest(context) {
  if (context.request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: BASE_HEADERS });
  }
  if (context.request.method !== "GET" && context.request.method !== "HEAD") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const start = normalizeDateKey(context.params.start);
  const end = normalizeDateKey(context.params.end);
  if (!start) {
    return jsonResponse({ error: "Invalid start date, expected YYYYMMDD or YYYY-MM-DD." }, 400);
  }
  if (!end) {
    return jsonResponse({ error: "Invalid end date, expected YYYYMMDD or YYYY-MM-DD." }, 400);
  }
  if (start > end) {
    return jsonResponse({ error: "Invalid range, start must be <= end." }, 400);
  }

  try {
    const images = await loadImages(context);
    const filtered = images.filter((image) => {
      const enddate = image?.enddate;
      return typeof enddate === "string" && enddate >= start && enddate <= end;
    });
    return jsonResponse({ images: filtered });
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
