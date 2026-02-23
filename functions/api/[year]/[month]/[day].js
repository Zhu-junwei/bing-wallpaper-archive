import {
  badRequest,
  isValidDay,
  isValidMonth,
  isValidYear,
  serveFilteredImages,
} from "../../../_lib/bing-api.js";

export async function onRequest(context) {
  const { year, month, day } = context.params;
  if (!isValidYear(year)) {
    return badRequest("Invalid year format, expected YYYY.");
  }
  if (!isValidMonth(month)) {
    return badRequest("Invalid month format, expected MM.");
  }
  if (!isValidDay(day)) {
    return badRequest("Invalid day format, expected DD.");
  }

  const exact = `${year}${month}${day}`;
  return serveFilteredImages(context, (enddate) => enddate === exact);
}
