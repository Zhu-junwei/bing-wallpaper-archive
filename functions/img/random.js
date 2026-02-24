import { loadImages } from "../_lib/bing-api.js";
import { pickRandomItems } from "../_lib/random-utils.js";
import {
  buildBingTargetUrl,
  IMAGE_HEADERS,
  imageJsonError,
  proxyBingImage,
} from "../_lib/img-api.js";

const RANDOM_IMAGE_NO_CACHE = "no-store, no-cache, must-revalidate, max-age=0";

function pickRandomImage(images) {
  const validImages = Array.isArray(images)
    ? images.filter((image) => /^\d{8}$/.test(image?.enddate || ""))
    : [];
  const [image] = pickRandomItems(validImages, 1);
  return image || null;
}

function withNoStoreCache(response) {
  const headers = new Headers(response.headers);
  headers.set("cache-control", RANDOM_IMAGE_NO_CACHE);
  headers.set("pragma", "no-cache");
  headers.set("expires", "0");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export async function onRequest(context) {
  if (context.request.method === "OPTIONS") {
    return withNoStoreCache(new Response(null, { status: 204, headers: IMAGE_HEADERS }));
  }
  if (context.request.method !== "GET" && context.request.method !== "HEAD") {
    return withNoStoreCache(imageJsonError("Method not allowed", 405));
  }

  let randomImage = null;
  try {
    const images = await loadImages(context);
    randomImage = pickRandomImage(images);
  } catch (error) {
    return withNoStoreCache(
      imageJsonError(
        `Failed to load wallpaper data: ${error instanceof Error ? error.message : String(error)}`,
        500,
      ),
    );
  }

  if (!randomImage || !randomImage.enddate) {
    return withNoStoreCache(imageJsonError("No wallpaper data available.", 404));
  }

  const requestUrl = new URL(context.request.url);
  const target = buildBingTargetUrl(randomImage, randomImage.enddate, requestUrl);
  if (target.error) {
    return withNoStoreCache(imageJsonError(target.error, 400));
  }

  const imageResponse = await proxyBingImage(context, target.url);
  return withNoStoreCache(imageResponse);
}
