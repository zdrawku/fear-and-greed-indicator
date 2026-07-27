const axios = require('axios');

const { HTTP_HEADERS, REQUEST_TIMEOUT_MS } = require('../config');
const { buildListing, looksPlugInHybrid, toInt } = require('../normalize');

/**
 * Škoda Bulgaria — the stock page is a React app, but it is backed by a plain
 * public JSON endpoint that needs no auth. Calling it directly avoids a browser
 * entirely and gives us cleanly typed fields instead of scraped strings.
 *
 * Discovered from the page's own network traffic:
 *   GET /apps/stock/451/bg-BG/api/search?CarType=U&Fuel=H&PageNo=1&...
 *   -> { results: { cars: [...], pageInfo: {...} } }
 *
 * CarType=U -> used, Fuel=H -> hybrid family (includes plug-in; we re-check
 * technicalData.fuel ourselves because "H" also covers non-plug-in hybrids).
 */

const BASE = 'https://www.skoda-auto.bg';
const SEARCH_PATH = '/apps/stock/451/bg-BG/api/search';
const DETAIL_PATH = '/apps/stock/carDetail';
const MAX_PAGES = 10; // safety stop; stock is normally a single page

function mapCar(car) {
  const fuelText = car?.technicalData?.fuel || '';
  const modelText = [car.model, car.title, car.subTitle].filter(Boolean).join(' ');

  return buildListing({
    adId: `skoda-${car.id}`,
    title: modelText.trim() || car.model || 'Škoda',
    brand: 'Skoda',
    model: modelText,
    url: `${BASE}${DETAIL_PATH}/${car.id}`,
    priceEur: car?.salePrice?.unit === 'EUR' ? toInt(car?.salePrice?.value) : toInt(car?.salePrice?.value),
    // initialReg is the registration date; modelYear can run a year ahead of it,
    // and the user's criterion is about the actual car, so prefer initialReg.
    year: car.initialReg ? new Date(car.initialReg).getUTCFullYear() : toInt(car.modelYear),
    mileageKm: toInt(car?.mileage?.value),
    isPlugInHybrid: looksPlugInHybrid(fuelText),
    dealer: car?.dealer?.name || null,
    location: car?.dealer?.city || null,
    unavailable: Boolean(car.isReserved),
    sourceId: 'skoda',
  });
}

async function fetchPage(pageNo) {
  const url = `${BASE}${SEARCH_PATH}`;
  const { data } = await axios.get(url, {
    headers: { ...HTTP_HEADERS, Accept: 'application/json' },
    timeout: REQUEST_TIMEOUT_MS,
    params: {
      CarType: 'U',
      Fuel: 'H',
      PageNo: pageNo,
      SortDirection: 1,
      SortKey: 'DATE_OFFER',
    },
  });

  return {
    cars: data?.results?.cars || [],
    pageInfo: data?.results?.pageInfo || null,
  };
}

async function scrape() {
  const collected = [];

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    // Pagination is inherently sequential — each response tells us whether to continue.
    // eslint-disable-next-line no-await-in-loop
    const { cars, pageInfo } = await fetchPage(page);
    collected.push(...cars);

    const totalPages = toInt(pageInfo?.totalPages ?? pageInfo?.pageCount);
    if (cars.length === 0) break;
    if (totalPages && page >= totalPages) break;
    if (!totalPages) break; // unknown shape: don't loop blindly
  }

  return collected.map(mapCar);
}

module.exports = { id: 'skoda', label: 'skoda-auto.bg', requiresBrowser: false, scrape, mapCar };
