const { CRITERIA, WANTED_MODELS } = require('./config');

/** 150000 -> "150 000" */
const num = (val) => (val == null ? '?' : Intl.NumberFormat('bg-BG').format(val));

/** Renders any per-model minYear overrides so the header doesn't silently lie about Santa Fe. */
function minYearExceptionsText() {
  const exceptions = WANTED_MODELS.filter((m) => m.minYear != null && m.minYear !== CRITERIA.minYear);
  if (exceptions.length === 0) return '';
  return ` (${exceptions.map((m) => `${m.model}: от ${m.minYear} г.`).join(', ')})`;
}

function formatListing(listing) {
  const parts = [
    listing.year ? `${listing.year} г.` : null,
    listing.mileageKm != null ? `${num(listing.mileageKm)} км` : null,
    listing.priceEur != null ? `${num(listing.priceEur)} €` : null,
  ].filter(Boolean);

  const seller = [listing.dealer, listing.location].filter(Boolean).join(', ');

  return [
    `🚙 [${listing.title}](${listing.url})`,
    `   ${parts.join(' | ')}`,
    seller ? `   _${seller}_` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

function groupByBrand(listings) {
  return listings.reduce((acc, listing) => {
    const key = listing.brand || 'Други';
    (acc[key] = acc[key] || []).push(listing);
    return acc;
  }, {});
}

function renderGroups(listings) {
  const groups = groupByBrand(listings);
  return Object.keys(groups)
    .sort()
    .map((brand) => `*${brand}*\n${groups[brand].map(formatListing).join('\n')}`)
    .join('\n\n');
}

/**
 * Builds the Telegram message. Returns null when there is nothing worth pinging
 * about, so the caller can stay silent instead of sending "no changes" spam.
 */
function buildMessage(
  { isFirstRun, newListings, stillAvailable, goneListings },
  { alwaysSend = false, partial = false } = {}
) {
  if (!isFirstRun && newListings.length === 0 && goneListings.length === 0 && !alwaysSend) {
    return null;
  }

  const header = `🔎 *PHEV SUV проверка* — до ${num(CRITERIA.maxPriceEur)} €, под ${num(CRITERIA.maxMileageKm)} км, от ${CRITERIA.minYear} г.${minYearExceptionsText()}`;
  const blocks = [header];

  if (partial) {
    blocks.push('⚠️ _Част от източниците не отговориха — списъкът може да е непълен._');
  }

  if (isFirstRun) {
    blocks.push(`📋 Базова проверка — ${newListings.length} налични обяви:`);
    blocks.push(renderGroups(newListings));
    return blocks.join('\n\n');
  }

  if (newListings.length > 0) {
    blocks.push(`🆕 *НОВИ обяви (${newListings.length})*`);
    blocks.push(renderGroups(newListings));
  } else {
    blocks.push('🆕 Няма нови обяви от последната проверка.');
  }

  if (stillAvailable.length > 0) {
    blocks.push(`📌 Останали налични: ${stillAvailable.length} обяви`);
  }

  // On a partial run a car can look "gone" simply because its source errored,
  // so we stay quiet about removals rather than raising a false alarm.
  if (goneListings.length > 0 && !partial) {
    const gone = goneListings.map((l) => `• ${l.title}`).join('\n');
    blocks.push(`❌ *Свалени/продадени (${goneListings.length})*\n${gone}`);
  }

  return blocks.join('\n\n');
}

module.exports = { buildMessage, formatListing, renderGroups };
