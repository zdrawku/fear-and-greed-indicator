const axios = require('axios');
const cheerio = require('cheerio');

const { HTTP_HEADERS, REQUEST_TIMEOUT_MS } = require('../config');
const { buildListing, isUnavailableText, looksPlugInHybrid, toInt } = require('../normalize');

/**
 * Honda Bulgaria — a WordPress site, fully server-rendered.
 *
 * Deliberate scope choice: we scrape `/s-probeg/` (used cars) and NOT
 * `/avtomobili-na-sklad/`. The latter is brand-new stock — it lists the CR-V
 * e:PHEV from ~53 000 €, which fails both the "used only" and the price rules,
 * so including it would only generate noise.
 *
 * ⚠️ Like Kia, the used-car page was empty when this was written, so the card
 * selectors are inferred from the site's WordPress markup rather than verified
 * against live stock. The parser fails soft and returns [] on no match.
 */

const USED_URL = 'https://cars.honda.bg/s-probeg/';

function parseUsedHtml(html) {
  const $ = cheerio.load(html);
  const listings = [];

  // WordPress themes vary; try the common card containers in order of specificity.
  const cards = $('.car-item, .vehicle-item, article.post, .wpb_column .vc_single_image-wrapper').toArray();

  cards.forEach((el, index) => {
    const $card = $(el);
    const text = $card.text().replace(/\s+/g, ' ').trim();
    if (!text || text.length < 20) return;

    // Only care about CR-V; the page may also carry Jazz/HR-V/Civic.
    if (!/cr-?v/i.test(text)) return;

    const href = $card.find('a').first().attr('href') || null;
    const title = $card.find('h2, h3, .title').first().text().replace(/\s+/g, ' ').trim() || text.slice(0, 60);

    const priceMatch = text.match(/([\d\s]+)\s*€/);
    const mileageMatch = text.match(/(\d[\d\s]*)\s*км(?![A-Za-zА-Яа-я])/);
    const yearMatch = text.match(/\b(20\d{2})\b/);

    listings.push(
      buildListing({
        adId: `honda-${href || index}`,
        title,
        brand: 'Honda',
        model: title,
        url: href,
        priceEur: priceMatch ? toInt(priceMatch[1]) : null,
        year: yearMatch ? toInt(yearMatch[1]) : null,
        mileageKm: mileageMatch ? toInt(mileageMatch[1]) : null,
        isPlugInHybrid: looksPlugInHybrid(text) || /e:phev/i.test(text),
        dealer: 'Honda Bulgaria',
        location: null,
        unavailable: isUnavailableText(text),
        sourceId: 'honda',
      })
    );
  });

  return listings;
}

async function scrape() {
  const { data: html } = await axios.get(USED_URL, {
    headers: HTTP_HEADERS,
    timeout: REQUEST_TIMEOUT_MS,
  });
  return parseUsedHtml(html);
}

module.exports = { id: 'honda', label: 'cars.honda.bg (с пробег)', requiresBrowser: false, scrape, parseUsedHtml };
