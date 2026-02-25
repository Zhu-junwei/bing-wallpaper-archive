import { loadImages, UHD_CUTOFF_DATE } from "../_lib/bing-api.js";
import { pickRandomItems } from "../_lib/random-utils.js";
import {
  buildBingTargetUrl,
  IMAGE_HEADERS,
  imageJsonError,
  proxyBingImage,
  withImageDateHeaders,
} from "../_lib/img-api.js";

const RANDOM_IMAGE_CACHE_CONTROL =
  "public, max-age=180, s-maxage=300, stale-while-revalidate=600";

function shouldLimitLegacyImages(requestUrl) {
  const searchParams = requestUrl.searchParams;
  const requestedRes = (searchParams.get("res") || "hd").trim().toLowerCase();
  const requestedWidth = (searchParams.get("w") || "").trim();
  const requestedHeight = (searchParams.get("h") || "").trim();
  const wantsUhd = requestedRes === "uhd" || requestedRes === "4k";
  const hasCustomSizeRequest = Boolean(requestedWidth || requestedHeight);
  return wantsUhd || hasCustomSizeRequest;
}

function pickRandomImage(images, limitLegacyImages) {
  const validImages = Array.isArray(images)
    ? images.filter((image) => {
        const enddate = image?.enddate || "";
        if (!/^\d{8}$/.test(enddate)) {
          return false;
        }
        if (limitLegacyImages && enddate < UHD_CUTOFF_DATE) {
          return false;
        }
        return true;
      })
    : [];
  const [image] = pickRandomItems(validImages, 1);
  return image || null;
}

function withShortCache(response) {
  const headers = new Headers(response.headers);
  headers.set("cache-control", RANDOM_IMAGE_CACHE_CONTROL);
  headers.delete("pragma");
  headers.delete("expires");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export async function onRequest(context) {
  const requestUrl = new URL(context.request.url);
  const limitLegacyImages = shouldLimitLegacyImages(requestUrl);
  if (context.request.method === "OPTIONS") {
    return withShortCache(new Response(null, { status: 204, headers: IMAGE_HEADERS }));
  }
  if (context.request.method !== "GET" && context.request.method !== "HEAD") {
    return withShortCache(imageJsonError("Method not allowed", 405));
  }

  let randomImage = null;
  try {
    const images = await loadImages(context);
    randomImage = pickRandomImage(images, limitLegacyImages);
  } catch (error) {
    return withShortCache(
      imageJsonError(
        `Failed to load wallpaper data: ${error instanceof Error ? error.message : String(error)}`,
        500,
      ),
    );
  }

  if (!randomImage || !randomImage.enddate) {
    return withShortCache(imageJsonError("No wallpaper data available.", 404));
  }
  if (limitLegacyImages && randomImage.enddate < UHD_CUTOFF_DATE) {
    return withShortCache(imageJsonError("No wallpaper data available for requested resolution.", 404));
  }

  const target = buildBingTargetUrl(randomImage, randomImage.enddate, requestUrl);
  if (target.error) {
    return withShortCache(imageJsonError(target.error, 400));
  }

  const imageResponse = await proxyBingImage(context, target.url);
  return withShortCache(withImageDateHeaders(imageResponse, randomImage.enddate, target.url));
}
