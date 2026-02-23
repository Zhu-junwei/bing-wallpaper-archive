import { badRequest, isValidYear, serveFilteredImages } from "../../_lib/bing-api.js";

export async function onRequest(context) {
  const { year } = context.params;
  if (!isValidYear(year)) {
    return badRequest("Invalid year format, expected YYYY.");
  }

  return serveFilteredImages(context, (enddate) => enddate.startsWith(year));
}
