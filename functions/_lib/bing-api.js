const DATASET_PATH = "/Bing_zh-CN_all.json";
const DATASET_CACHE_TTL_MS = 5 * 60 * 1000;
export const UHD_CUTOFF_DATE = "20190510";
const BING_HOST = "https://www.bing.com";

export const BASE_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "public, max-age=300, must-revalidate",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, HEAD, OPTIONS",
};

let datasetCache = {
  expiresAt: 0,
  images: null,
};

export function jsonResponse(payload, status = 200) {
  return new Response(`${JSON.stringify(payload, null, 2)}\n`, {
    status,
    headers: BASE_HEADERS,
  });
}

export function isValidYear(value) {
  return /^\d{4}$/.test(value);
}

export function isValidMonth(value) {
  return /^(0[1-9]|1[0-2])$/.test(value);
}

export function isValidDay(value) {
  return /^(0[1-9]|[12]\d|3[01])$/.test(value);
}

export function toBingAbsolute(path) {
  if (!path) {
    return "";
  }
  if (path.startsWith("https://") || path.startsWith("http://")) {
    return path;
  }
  return `${BING_HOST}${path}`;
}

export async function loadImages(context) {
  const now = Date.now();
  if (datasetCache.images && now < datasetCache.expiresAt) {
    return datasetCache.images;
  }

  const datasetUrl = new URL(context.request.url);
  datasetUrl.pathname = DATASET_PATH;
  datasetUrl.search = "";

  const response = await context.env.ASSETS.fetch(datasetUrl.toString());
  if (!response.ok) {
    throw new Error(`Failed to load ${DATASET_PATH}: ${response.status}`);
  }

  const payload = await response.json();
  if (!payload || !Array.isArray(payload.images)) {
    throw new Error(`Invalid ${DATASET_PATH} payload`);
  }

  datasetCache = {
    expiresAt: now + DATASET_CACHE_TTL_MS,
    images: payload.images,
  };

  return payload.images;
}

export async function findImageByEnddate(context, enddate) {
  const images = await loadImages(context);
  return images.find((image) => image?.enddate === enddate) || null;
}

export async function serveFilteredImages(context, predicate) {
  if (context.request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: BASE_HEADERS });
  }

  if (context.request.method !== "GET" && context.request.method !== "HEAD") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const images = await loadImages(context);
    const filteredImages = images.filter((image) => {
      return typeof image?.enddate === "string" && predicate(image.enddate);
    });
    return jsonResponse({ images: filteredImages });
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

export function badRequest(message) {
  return jsonResponse({ error: message }, 400);
}
