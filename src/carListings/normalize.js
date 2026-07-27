/**
 * Shared helpers every source module uses to emit the same listing shape.
 *
 * Canonical listing:
 *   { adId, title, brand, model, minYear, url, priceEur, year, mileageKm,
 *     isPlugInHybrid, dealer, location, unavailable, sourceId }
 */

const { UNAVAILABLE_MARKERS, WANTED_MODELS } = require('./config');

/** "40 406" | "40,406" | 40406 -> 40406 */
function toInt(value) {
  if (value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? Math.round(value) : null;
  const digits = String(value).replace(/[^\d]/g, '');
  if (!digits) return null;
  const parsed = parseInt(digits, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function isUnavailableText(text = '') {
  const upper = String(text).toUpperCase();
  return UNAVAILABLE_MARKERS.some((marker) => upper.includes(marker));
}

/** Bulgarian and English spellings both appear across these sites. */
function looksPlugInHybrid(text = '') {
  return /plug-?in|плъгин|плугин|phev/i.test(String(text));
}

/**
 * Maps a free-text model name onto one of the models we actually care about.
 * Returns null when the car isn't one of them, which is how non-target stock
 * (a Škoda Octavia, a Hyundai i20) gets dropped before any other check runs.
 */
function matchWantedModel(text = '') {
  const haystack = String(text).toLowerCase().replace(/[-\s]+/g, ' ');
  return (
    WANTED_MODELS.find(({ patterns }) =>
      patterns.some((pattern) => haystack.includes(pattern))
    ) || null
  );
}

/**
 * Builds a canonical listing.
 *
 * Important: `model` is the *canonical wanted model* and is null when the car
 * isn't one we're shopping for. criteria.js relies on that — if this fell back
 * to the raw model text, a Škoda Octavia or a Hyundai i20 would sail through the
 * model gate and get judged purely on price/year/mileage. The raw name stays
 * available in `title` for display.
 *
 * `minYear` carries the matched model's per-model year override (see Santa Fe
 * in config.js) so criteria.js can apply it without re-matching the model itself.
 * It's null when the model has no override, meaning "use CRITERIA.minYear".
 */
function buildListing(raw) {
  const matched = raw.matchedModel || matchWantedModel(`${raw.brand || ''} ${raw.model || ''} ${raw.title || ''}`);

  return {
    adId: String(raw.adId),
    title: raw.title || null,
    brand: matched ? matched.brand : null,
    model: matched ? matched.model : null,
    minYear: matched && matched.minYear != null ? matched.minYear : null,
    url: raw.url || null,
    priceEur: toInt(raw.priceEur),
    year: toInt(raw.year),
    mileageKm: toInt(raw.mileageKm),
    isPlugInHybrid: Boolean(raw.isPlugInHybrid),
    dealer: raw.dealer || null,
    location: raw.location || null,
    unavailable: Boolean(raw.unavailable),
    sourceId: raw.sourceId || null,
  };
}

module.exports = { toInt, isUnavailableText, looksPlugInHybrid, matchWantedModel, buildListing };
