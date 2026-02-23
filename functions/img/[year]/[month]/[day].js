import {
  findImageByEnddate,
  isValidDay,
  isValidMonth,
  isValidYear,
} from "../../../_lib/bing-api.js";
import {
  buildBingTargetUrl,
  IMAGE_HEADERS,
  imageJsonError,
  proxyBingImage,
} from "../../../_lib/img-api.js";

export async function onRequest(context) {
  if (context.request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: IMAGE_HEADERS });
  }
  if (context.request.method !== "GET" && context.request.method !== "HEAD") {
    return imageJsonError("Method not allowed", 405);
  }

  const { year, month, day } = context.params;
  if (!isValidYear(year)) {
    return imageJsonError("Invalid year format, expected YYYY.", 400);
  }
  if (!isValidMonth(month)) {
    return imageJsonError("Invalid month format, expected MM.", 400);
  }
  if (!isValidDay(day)) {
    return imageJsonError("Invalid day format, expected DD.", 400);
  }

  const enddate = `${year}${month}${day}`;

  let image = null;
  try {
    image = await findImageByEnddate(context, enddate);
  } catch (error) {
    return imageJsonError(
      `Failed to load wallpaper data: ${error instanceof Error ? error.message : String(error)}`,
      500,
    );
  }

  if (!image) {
    return imageJsonError("No wallpaper found for this date.", 404);
  }

  const requestUrl = new URL(context.request.url);
  const target = buildBingTargetUrl(image, enddate, requestUrl);
  if (target.error) {
    return imageJsonError(target.error, 400);
  }

  return proxyBingImage(context, target.url);
}
