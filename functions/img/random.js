import { loadImages } from "../_lib/bing-api.js";
import { pickRandomItems } from "../_lib/random-utils.js";
import {
  buildBingTargetUrl,
  IMAGE_HEADERS,
  imageJsonError,
  proxyBingImage,
} from "../_lib/img-api.js";

function pickRandomImage(images) {
  const validImages = Array.isArray(images)
    ? images.filter((image) => /^\d{8}$/.test(image?.enddate || ""))
    : [];
  const [image] = pickRandomItems(validImages, 1);
  return image || null;
}

export async function onRequest(context) {
  if (context.request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: IMAGE_HEADERS });
  }
  if (context.request.method !== "GET" && context.request.method !== "HEAD") {
    return imageJsonError("Method not allowed", 405);
  }

  let randomImage = null;
  try {
    const images = await loadImages(context);
    randomImage = pickRandomImage(images);
  } catch (error) {
    return imageJsonError(
      `Failed to load wallpaper data: ${error instanceof Error ? error.message : String(error)}`,
      500,
    );
  }

  if (!randomImage || !randomImage.enddate) {
    return imageJsonError("No wallpaper data available.", 404);
  }

  const requestUrl = new URL(context.request.url);
  const target = buildBingTargetUrl(randomImage, randomImage.enddate, requestUrl);
  if (target.error) {
    return imageJsonError(target.error, 400);
  }

  return proxyBingImage(context, target.url);
}
