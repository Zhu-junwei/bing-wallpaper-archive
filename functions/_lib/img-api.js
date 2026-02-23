import { toBingAbsolute, UHD_CUTOFF_DATE } from "./bing-api.js";

export const IMAGE_HEADERS = {
  "cache-control": "public, max-age=300, s-maxage=900, stale-while-revalidate=86400",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, HEAD, OPTIONS",
};

export function imageJsonError(message, status) {
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

export function buildBingTargetUrl(image, enddate, requestUrl) {
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

export async function proxyBingImage(context, targetUrl) {
  const upstream = await fetch(targetUrl, {
    method: context.request.method,
    redirect: "follow",
  });

  if (!upstream.ok) {
    return imageJsonError(`Failed to fetch image from Bing: HTTP ${upstream.status}`, 502);
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
