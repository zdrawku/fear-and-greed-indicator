const { CRITERIA } = require('./config');

/**
 * The single place where "do I want this car?" is decided. Every source funnels
 * through here, so the rules can't drift between sites.
 *
 * Rejection reasons are returned rather than swallowed — a run that finds nothing
 * should be debuggable from its own log without re-scraping.
 */
function applyCriteria(listing) {
  const reasons = [];

  // Model gate first: buildListing() only sets `model` when the car matched one
  // of WANTED_MODELS, so a null here means it isn't a car we're shopping for.
  if (!listing.model) reasons.push('not a wanted model');

  if (listing.unavailable) reasons.push('sold/reserved');

  if (CRITERIA.requirePlugInHybrid && !listing.isPlugInHybrid) reasons.push('not plug-in hybrid');

  if (listing.year == null) reasons.push('year unknown');
  else if (listing.year < CRITERIA.minYear) reasons.push(`year ${listing.year} < ${CRITERIA.minYear}`);

  if (listing.priceEur == null) reasons.push('price unknown');
  else if (listing.priceEur > CRITERIA.maxPriceEur) reasons.push(`price ${listing.priceEur} > ${CRITERIA.maxPriceEur}`);

  if (listing.mileageKm == null) reasons.push('mileage unknown');
  else if (listing.mileageKm >= CRITERIA.maxMileageKm) {
    reasons.push(`mileage ${listing.mileageKm} >= ${CRITERIA.maxMileageKm}`);
  }

  return { passes: reasons.length === 0, reasons };
}

module.exports = { applyCriteria };
