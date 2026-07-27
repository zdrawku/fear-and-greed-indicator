const axios = require('axios');
const cheerio = require('cheerio');

const { MOBILE_BG_SEARCHES, HTTP_HEADERS, REQUEST_TIMEOUT_MS } = require('../config');
const { buildListing, isUnavailableText, looksPlugInHybrid, toInt } = require('../normalize');

/**
 * mobile.bg — server-rendered, so axios + cheerio is enough.
 *
 * Each result is `div.item[id="ida<adId>"]`; that adId is stable across runs and
 * is what the new-listing diff keys on.
 */

const BG_MONTHS = {
  януари: 1, февруари: 2, март: 3, април: 4, май: 5, юни: 6,
  юли: 7, август: 8, септември: 9, октомври: 10, ноември: 11, декември: 12,
};

/** "31 990 €62 567.00 лв." -> 31990 */
function parsePriceEur(raw = '') {
  const match = raw.replace(/ /g, ' ').match(/([\d\s]+)\s*€/);
  return match ? toInt(match[1]) : null;
}

/** "септември 2022 г. 200 000 км Черен Plug-in хибрид 394 к.с. ..." */
function parseParams(raw = '') {
  const text = raw.replace(/ /g, ' ').replace(/\s+/g, ' ').trim();

  const yearMatch = text.match(/(\d{4})\s*г\./);
  const monthMatch = text.match(/^([А-Яа-яЁё]+)\s+\d{4}\s*г\./);
  // NB: no \b after "км" — JS word boundaries are ASCII-only, so \b never fires
  // after a Cyrillic letter. A negative lookahead for letters does the job.
  const mileageMatch = text.match(/(\d[\d\s]*)\s*км(?![A-Za-zА-Яа-я])/);

  return {
    year: yearMatch ? toInt(yearMatch[1]) : null,
    month: monthMatch ? BG_MONTHS[monthMatch[1].toLowerCase()] ?? null : null,
    mileageKm: mileageMatch ? toInt(mileageMatch[1]) : null,
    isPlugInHybrid: looksPlugInHybrid(text),
    raw: text,
  };
}

function parseSearchHtml(html, sourceId) {
  const $ = cheerio.load(html);
  const listings = [];

  $('div.item[id^="ida"]').each((_, el) => {
    const $item = $(el);
    const adId = $item.attr('id').replace(/^ida/, '');

    const $title = $item.find('a.title').first();
    const title = $title.text().trim();
    if (!title) return;

    const href = $title.attr('href') || '';
    const url = href.startsWith('//') ? `https:${href}` : href;

    const params = parseParams($item.find('div.params').first().text());

    listings.push(
      buildListing({
        adId,
        title,
        model: title,
        url,
        priceEur: parsePriceEur($item.find('div.price').first().text()),
        year: params.year,
        mileageKm: params.mileageKm,
        isPlugInHybrid: params.isPlugInHybrid,
        dealer: $item.find('div.sInfo div.name').first().text().trim() || null,
        location: $item.find('div.sInfo div.location').first().text().replace(/\s+/g, ' ').trim() || null,
        unavailable: isUnavailableText(title) || isUnavailableText(params.raw),
        sourceId,
      })
    );
  });

  return listings;
}

async function scrape() {
  const perSearch = await Promise.all(
    MOBILE_BG_SEARCHES.map(async (search) => {
      const { data: html } = await axios.get(search.url, {
        headers: HTTP_HEADERS,
        timeout: REQUEST_TIMEOUT_MS,
      });
      return parseSearchHtml(html, search.id);
    })
  );

  return perSearch.flat();
}

module.exports = {
  id: 'mobileBg',
  label: 'mobile.bg',
  requiresBrowser: false,
  scrape,
  // exported for tests
  parseSearchHtml,
  parsePriceEur,
  parseParams,
};
