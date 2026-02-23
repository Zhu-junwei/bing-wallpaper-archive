import {
  badRequest,
  isValidMonth,
  isValidYear,
  serveFilteredImages,
} from "../../_lib/bing-api.js";

export async function onRequest(context) {
  const { year, month } = context.params;
  if (!isValidYear(year)) {
    return badRequest("Invalid year format, expected YYYY.");
  }
  if (!isValidMonth(month)) {
    return badRequest("Invalid month format, expected MM.");
  }

  const prefix = `${year}${month}`;
  return serveFilteredImages(context, (enddate) => enddate.startsWith(prefix));
}
