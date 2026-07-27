const axios = require('axios');
const cheerio = require('cheerio');

const { HTTP_HEADERS, REQUEST_TIMEOUT_MS } = require('../config');
const { buildListing, isUnavailableText, looksPlugInHybrid, toInt } = require('../normalize');

/**
 * Hyundai Bulgaria — the friendliest of the lot.
 *
 * The page ships its entire used-car inventory as `li.hidden-car` elements and
 * filters them client-side, so a plain GET returns every car regardless of the
 * query string. Better still, each card carries typed data-* attributes:
 *
 *   data-car_id, data-model_level2_value, data-fueltype_value,
 *   data-regdate_value (YYYYMMDD), data-mileage_value, data-price_value
 *
 * We read those instead of parsing display text — no locale or markup surprises.
 * The URL below therefore needs no filters; we do all filtering ourselves.
 */

const LISTING_URL = 'https://hyundai.bg/upotrebyavani-avtomobili/';

function parseListingHtml(html) {
  const $ = cheerio.load(html);
  const listings = [];

  $('li.hidden-car').each((_, el) => {
    const $card = $(el);
    const data = $card.attr();

    const carId = data['data-car_id'] || data['data-id'];
    if (!carId) return;

    const model = data['data-model_level2_value'] || '';
    const brand = data['data-manufacturer_level1_value'] || 'HYUNDAI';
    const fuel = data['data-fueltype_value'] || '';

    // regdate is YYYYMMDD, e.g. "20250806"
    const regDate = data['data-regdate_value'] || '';
    const year = /^\d{8}$/.test(regDate) ? toInt(regDate.slice(0, 4)) : null;

    const href = $card.find('a.details').first().attr('href') || null;
    const cardText = $card.text().replace(/\s+/g, ' ').trim();

    listings.push(
      buildListing({
        adId: `hyundai-${carId}`,
        title: `${brand} ${model}`.trim(),
        brand: 'Hyundai',
        model,
        url: href,
        priceEur: toInt(data['data-price_value']),
        year,
        mileageKm: toInt(data['data-mileage_value']),
        isPlugInHybrid: looksPlugInHybrid(fuel),
        dealer: 'Hyundai Bulgaria',
        location: null,
        // "РЕЗЕРВИРАН" is rendered as a badge inside the card
        unavailable: isUnavailableText(cardText),
        sourceId: 'hyundai',
      })
    );
  });

  return listings;
}

async function scrape() {
  const { data: html } = await axios.get(LISTING_URL, {
    headers: HTTP_HEADERS,
    timeout: REQUEST_TIMEOUT_MS,
  });
  return parseListingHtml(html);
}

module.exports = { id: 'hyundai', label: 'hyundai.bg', requiresBrowser: false, scrape, parseListingHtml };
