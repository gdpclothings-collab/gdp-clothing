const asList = (value) => Array.isArray(value) ? value : [];
const compact = (value) => String(value || "").trim().toUpperCase().replace(/\s+/g, "");
const numberOr = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export function postalPatternMatches(pattern, postalCode) {
  const normalizedPattern = compact(pattern).replace(/[^A-Z0-9*]/g, "");
  const normalizedPostal = compact(postalCode).replace(/[^A-Z0-9]/g, "");
  if (!normalizedPattern || !normalizedPostal) return false;
  const escaped = normalizedPattern
    .split("*")
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${escaped}$`).test(normalizedPostal);
}

export function shippingRateMatchesDestination(rate, destination = {}) {
  const countryCode = compact(destination.countryCode || "CA");
  const provinceCode = compact(destination.provinceCode);
  const postalCode = compact(destination.postalCode);
  const countryCodes = asList(rate?.country_codes).map(compact).filter(Boolean);
  const provinceCodes = asList(rate?.province_codes).map(compact).filter(Boolean);
  const postalPatterns = asList(rate?.postal_patterns).map((value) => String(value || "").trim()).filter(Boolean);

  if (countryCodes.length && !countryCodes.includes(countryCode)) return false;
  if (provinceCodes.length && (!provinceCode || !provinceCodes.includes(provinceCode))) return false;
  if (postalPatterns.length && (!postalCode || !postalPatterns.some((pattern) => postalPatternMatches(pattern, postalCode)))) return false;
  return true;
}

function specificity(rate) {
  if (asList(rate?.postal_patterns).length) return 2;
  if (asList(rate?.province_codes).length) return 1;
  return 0;
}

export function selectShippingRate(rates, destination = {}) {
  const amount = Math.max(0, numberOr(destination.amount, 0));
  return (Array.isArray(rates) ? rates : [])
    .filter((rate) => {
      const min = rate?.min_order == null ? 0 : numberOr(rate.min_order, 0);
      const max = rate?.max_order == null ? Number.POSITIVE_INFINITY : numberOr(rate.max_order, Number.NEGATIVE_INFINITY);
      return amount >= min && amount <= max && shippingRateMatchesDestination(rate, destination);
    })
    .sort((a, b) => {
      const specificityDelta = specificity(b) - specificity(a);
      if (specificityDelta) return specificityDelta;
      const priorityDelta = numberOr(a?.priority, 100) - numberOr(b?.priority, 100);
      if (priorityDelta) return priorityDelta;
      const minOrderDelta = numberOr(b?.min_order, 0) - numberOr(a?.min_order, 0);
      if (minOrderDelta) return minOrderDelta;
      return String(a?.name || "").localeCompare(String(b?.name || ""));
    })[0] || null;
}
