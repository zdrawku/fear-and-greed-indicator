/**
 * Search configuration for the PHEV SUV listing notifier.
 *
 * `CRITERIA` is applied uniformly to every source, on top of whatever filtering
 * the site itself does. That matters because the sites disagree about what their
 * own filters mean: mobile.bg has no mileage filter in the URL scheme we use,
 * Hyundai renders its whole inventory and filters client-side, and several sites
 * keep sold cars visible for a while after the fact.
 */

const CRITERIA = {
  minYear: 2022,
  maxPriceEur: 35000,
  maxMileageKm: 150000, // strict: a car at exactly 150 000 km is rejected
  requirePlugInHybrid: true,
};

/** Markers that mean "this is no longer actually for sale". */
const UNAVAILABLE_MARKERS = [
  'ПРОДАДЕН',
  'ПРОДАДЕНА',
  'ПРОДАДЕНО',
  'КАПАРИРАН',
  'РЕЗЕРВИРАН',
  'SOLD',
];

/**
 * The models we're shopping for. `patterns` are matched lowercase against a
 * whitespace-normalised haystack, so "Santa Fe", "SANTA FE" and "santa-fe" all hit.
 *
 * `minYear` is an optional per-model override of `CRITERIA.minYear`. Santa Fe
 * needs one because Hyundai redesigned it for MY2024 (the 5th generation,
 * boxier body) — the pre-2024 car is a different generation, not just an older
 * copy of the same one, so the global 2022 cutoff is too loose for it.
 */
const WANTED_MODELS = [
  { brand: 'Skoda', model: 'Kodiaq', patterns: ['kodiaq'] },
  { brand: 'Toyota', model: 'RAV4', patterns: ['rav4', 'rav 4'] },
  { brand: 'Hyundai', model: 'Santa Fe', patterns: ['santa fe', 'santafe'], minYear: 2024 },
  { brand: 'Kia', model: 'Sorento', patterns: ['sorento'] },
  { brand: 'BMW', model: 'X5', patterns: ['x5'] },
  { brand: 'Honda', model: 'CR-V', patterns: ['cr v', 'crv', 'cr-v'] },
];

/**
 * Per-source toggles. Flip `enabled` to false to skip a source without deleting
 * its module — useful when a site changes its markup and starts throwing.
 */
const SOURCE_SETTINGS = {
  mobileBg: { enabled: true },
  skoda: { enabled: true },
  hyundai: { enabled: true },
  kia: { enabled: true },
  honda: { enabled: true },
  toyota: { enabled: true }, // the only source that needs a real browser
};

/** mobile.bg saved searches — filters are encoded in the query string. */
const MOBILE_BG_SEARCHES = [
  {
    id: 'mobile-bg-bmw-hyundai-toyota',
    label: 'BMW X5 / Hyundai Santa Fe / Toyota RAV4',
    url: 'https://www.mobile.bg/obiavi/avtomobili-dzhipove/bmw/x5/plug-in-hibrid/avtomatichna/ot-2022/namira-se-v-balgariya?price1=35000&nup=014&marka1=Hyundai&model1=Santa%20fe&marka2=Toyota&model2=Rav4',
  },
  {
    id: 'mobile-bg-skoda-kia-honda',
    label: 'Skoda Kodiaq / Kia Sorento / Honda CR-V',
    url: 'https://www.mobile.bg/obiavi/avtomobili-dzhipove/honda/cr-v/plug-in-hibrid/ot-2022/namira-se-v-balgariya?price1=35000&nup=014&marka1=Kia&model1=Sedona~Seltos~Sorento&marka2=Skoda&model2=Kodiaq',
  },
  {
    // Dedicated Santa Fe search with the site's own year filter set to 2024 —
    // matches the per-model minYear override above. Kept alongside the combined
    // search rather than replacing Santa Fe there: the two overlap, but
    // collectListings() in carNotifier.js dedupes by adId, so the only cost is
    // a slightly redundant fetch, and this one does the 2024 cutoff server-side
    // instead of relying purely on our own criteria pass.
    id: 'mobile-bg-santa-fe-2024',
    label: 'Hyundai Santa Fe (2024+)',
    url: 'https://www.mobile.bg/obiavi/avtomobili-dzhipove/hyundai/santa-fe/plug-in-hibrid/avtomatichna/ot-2024/namira-se-v-balgariya?nup=014',
  },
];

/** Shared across every axios call — some of these sites 403 a bare user agent. */
const HTTP_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'bg,en;q=0.9',
};

const REQUEST_TIMEOUT_MS = 25000;

module.exports = {
  CRITERIA,
  UNAVAILABLE_MARKERS,
  WANTED_MODELS,
  SOURCE_SETTINGS,
  MOBILE_BG_SEARCHES,
  HTTP_HEADERS,
  REQUEST_TIMEOUT_MS,
};
