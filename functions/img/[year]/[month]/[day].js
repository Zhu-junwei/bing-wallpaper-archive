import {
  findImageByEnddate,
  isValidDay,
  isValidMonth,
  isValidYear,
  toBingAbsolute,
  UHD_CUTOFF_DATE,
} from "../../../_lib/bing-api.js";

const IMAGE_HEADERS = {
  "cache-control": "public, max-age=300, s-maxage=900, stale-while-revalidate=86400",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, HEAD, OPTIONS",
};

function jsonError(message, status) {
  return new Response(`${JSON.stringify({ error: message }, null, 2)}\n`, {
    status,
    headers: {
      ...IMAGE_HEADERS,
      "content-type": "application/json; charset=utf-8",
    },
  });
}

function isPositiveIntegerText(value) {
  return /^\d+$/.test(value) && Number(value) > 0;
}

function setOrAppendSize(path, width, height) {
  const absolute = toBingAbsolute(path);
  const nextUrl = new URL(absolute);
  nextUrl.searchParams.set("w", width);
  nextUrl.searchParams.set("h", height);
  nextUrl.searchParams.set("rs", "1");
  nextUrl.searchParams.set("c", "4");
  return nextUrl.toString();
}

function buildBingTargetUrl(image, enddate, requestUrl) {
  const rawUrl = typeof image?.url === "string" ? image.url.trim() : "";
  const rawUrlBase = typeof image?.urlbase === "string" ? image.urlbase.trim() : "";
  const searchParams = requestUrl.searchParams;
  const requestedRes = (searchParams.get("res") || "hd").trim().toLowerCase();
  const requestedWidth = (searchParams.get("w") || "").trim();
  const requestedHeight = (searchParams.get("h") || "").trim();
  const beforeUhdCutoff = enddate < UHD_CUTOFF_DATE;

  if (beforeUhdCutoff) {
    // Legacy records only provide 1080P.
    return {
      url: toBingAbsolute(rawUrl),
      mode: "legacy-hd",
    };
  }

  const hasCustomSize = requestedWidth || requestedHeight;
  if ((requestedWidth && !requestedHeight) || (!requestedWidth && requestedHeight)) {
    return { error: "Custom size requires both w and h, e.g. ?w=2560&h=1440" };
  }
  if (requestedWidth && !isPositiveIntegerText(requestedWidth)) {
    return { error: "Invalid w, expected positive integer." };
  }
  if (requestedHeight && !isPositiveIntegerText(requestedHeight)) {
    return { error: "Invalid h, expected positive integer." };
  }

  const wantsUhd = requestedRes === "uhd" || requestedRes === "4k";
  if (wantsUhd) {
    if (rawUrlBase) {
      return {
        url: toBingAbsolute(`${rawUrlBase}_UHD.jpg`),
        mode: "uhd",
      };
    }
    if (rawUrl) {
      return {
        url: toBingAbsolute(rawUrl),
        mode: "fallback-hd",
      };
    }
    return { error: "Image source not available." };
  }

  if (requestedRes && requestedRes !== "hd" && requestedRes !== "1080p" && requestedRes !== "1080") {
    return { error: "Invalid res, expected hd or uhd." };
  }

  if (rawUrlBase) {
    const width = requestedWidth || "1920";
    const height = requestedHeight || "1080";
    return {
      url: `${toBingAbsolute(`${rawUrlBase}_UHD.jpg`)}&rf=LaDigue_UHD.jpg&pid=hp&w=${width}&h=${height}&rs=1&c=4`,
      mode: hasCustomSize ? "custom" : "hd",
    };
  }

  if (rawUrl) {
    if (hasCustomSize) {
      return {
        url: setOrAppendSize(rawUrl, requestedWidth, requestedHeight),
        mode: "custom",
      };
    }
    return {
      url: toBingAbsolute(rawUrl),
      mode: "hd",
    };
  }

  return { error: "Image source not available." };
}

export async function onRequest(context) {
  if (context.request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: IMAGE_HEADERS });
  }
  if (context.request.method !== "GET" && context.request.method !== "HEAD") {
    return jsonError("Method not allowed", 405);
  }

  const { year, month, day } = context.params;
  if (!isValidYear(year)) {
    return jsonError("Invalid year format, expected YYYY.", 400);
  }
  if (!isValidMonth(month)) {
    return jsonError("Invalid month format, expected MM.", 400);
  }
  if (!isValidDay(day)) {
    return jsonError("Invalid day format, expected DD.", 400);
  }

  const enddate = `${year}${month}${day}`;

  let image = null;
  try {
    image = await findImageByEnddate(context, enddate);
  } catch (error) {
    return jsonError(
      `Failed to load wallpaper data: ${error instanceof Error ? error.message : String(error)}`,
      500,
    );
  }

  if (!image) {
    return jsonError("No wallpaper found for this date.", 404);
  }

  const requestUrl = new URL(context.request.url);
  const target = buildBingTargetUrl(image, enddate, requestUrl);
  if (target.error) {
    return jsonError(target.error, 400);
  }

  const upstream = await fetch(target.url, {
    method: context.request.method,
    redirect: "follow",
  });

  if (!upstream.ok) {
    return jsonError(`Failed to fetch image from Bing: HTTP ${upstream.status}`, 502);
  }

  const headers = new Headers(upstream.headers);
  headers.set("cache-control", IMAGE_HEADERS["cache-control"]);
  headers.set("access-control-allow-origin", IMAGE_HEADERS["access-control-allow-origin"]);
  headers.set("access-control-allow-methods", IMAGE_HEADERS["access-control-allow-methods"]);
  headers.delete("set-cookie");

  return new Response(context.request.method === "HEAD" ? null : upstream.body, {
    status: upstream.status,
    headers,
  });
}
