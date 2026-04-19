export function parseNumber(value) {
  if (!value) {
    return null;
  }

  let cleaned = String(value).trim();
  if (!cleaned) {
    return null;
  }

  cleaned = cleaned.replace(/[\s\u00a0]/g, "");

  if (cleaned.includes(",") && cleaned.includes(".")) {
    if (cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")) {
      cleaned = cleaned.replace(/\./g, "").replace(/,/g, ".");
    } else {
      cleaned = cleaned.replace(/,/g, "");
    }
  } else if (cleaned.includes(",")) {
    if (/,[0-9]{1,4}$/.test(cleaned)) {
      cleaned = cleaned.replace(/,/g, ".");
    } else {
      cleaned = cleaned.replace(/,/g, "");
    }
  }

  cleaned = cleaned.replace(/[^0-9.-]/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parsePercent(value) {
  if (!value) {
    return null;
  }

  return parseNumber(String(value).replace(/%/g, ""));
}
