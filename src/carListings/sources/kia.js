const axios = require('axios');
const cheerio = require('cheerio');

const { HTTP_HEADERS, REQUEST_TIMEOUT_MS } = require('../config');
const { buildListing, isUnavailableText, looksPlugInHybrid, toInt } = require('../normalize');

/**
 * Kia Bulgaria outlet ("Тестови автомобили за продажба") — server-rendered.
 *
 * ⚠️ Caveat worth knowing: at the time this was written the outlet inventory was
 * completely empty — the page renders "Няма намерени резултати" even with no
 * filters applied. That means the per-car card markup could not be verified
 * against real stock, and the selectors below are a best guess based on the
 * page's general product-card pattern (`.products__list-item` / `.product`).
 *
 * The scraper is written to fail soft: if the markup doesn't match, it returns
 * an empty array rather than throwing, so a Kia markup change can never take
 * down the whole run. Re-verify the selectors the first time real stock appears.
 */

const OUTLET_URL = 'https://kia.bg/bg/outlet-cars';

/** The page renders this when the outlet has nothing in it. */
function hasNoResults($) {
  return $('.js-msg, .products__msg').text().includes('Няма намерени резултати');
}

function parseOutletHtml(html) {
  const $ = cheerio.load(html);
  if (hasNoResults($)) return [];

  const listings = [];

  $('.products__list-item').each((index, el) => {
    const $card = $(el);
    const text = $card.text().replace(/\s+/g, ' ').trim();
    if (!text) return;

    // The same class is reused by the "browse new models" showcase, whose cards
    // say "Цена от:" (price *from*). Real outlet cars quote a single price.
    if (/Цена от:/i.test(text)) return;

    const href = $card.find('a').first().attr('href') || null;
    const url = href && href.startsWith('/') ? `https://kia.bg${href}` : href;

    const title = $card.find('.product__title').first().text().replace(/\s+/g, ' ').trim() || text.slice(0, 60);
    const priceMatch = text.match(/([\d\s]+)\s*€/);
    const mileageMatch = text.match(/(\d[\d\s]*)\s*км(?![A-Za-zА-Яа-я])/);
    const yearMatch = text.match(/\b(20\d{2})\b/);

    listings.push(
      buildListing({
        adId: `kia-${href || index}`,
        title,
        brand: 'Kia',
        model: title,
        url,
        priceEur: priceMatch ? toInt(priceMatch[1]) : null,
        year: yearMatch ? toInt(yearMatch[1]) : null,
        mileageKm: mileageMatch ? toInt(mileageMatch[1]) : null,
        isPlugInHybrid: looksPlugInHybrid(text),
        dealer: 'Kia Bulgaria (outlet)',
        location: null,
        unavailable: isUnavailableText(text),
        sourceId: 'kia',
      })
    );
  });

  return listings;
}

async function scrape() {
  const { data: html } = await axios.get(OUTLET_URL, {
    headers: HTTP_HEADERS,
    timeout: REQUEST_TIMEOUT_MS,
  });
  return parseOutletHtml(html);
}

module.exports = { id: 'kia', label: 'kia.bg outlet', requiresBrowser: false, scrape, parseOutletHtml };
