const { withPage } = require('../browser');
const { buildListing, isUnavailableText, looksPlugInHybrid, toInt } = require('../normalize');

/**
 * Toyota Bulgaria — the only source that genuinely needs a browser.
 *
 * The listing grid is rendered entirely client-side: the server HTML contains
 * the filter dropdowns but none of the cars (no __NEXT_DATA__, no hydration
 * payload, no public JSON endpoint), so cheerio has nothing to chew on.
 *
 * Two markup facts worth writing down:
 *
 * 1. Class names come from styled-components and carry a build hash
 *    (`UsedCarResultStyles__Wrapper-sc-nmyu5z-0 kMmxTC`). The hash changes on
 *    every deploy, so we match on the stable semantic prefix via [class*=...]
 *    rather than the full class name.
 *
 * 2. The "Гориво" spec reads "Хибрид Бензин" for BOTH regular hybrids and
 *    plug-in hybrids — it does not distinguish them. The only reliable plug-in
 *    signal is the trim line in the title/subtitle ("2.5 Plug-In Hybrid Style
 *    AWD"), so that's what we test.
 */

const BASE_URL = 'https://www.toyota.bg/used-cars';
const BRAND_TOYOTA = '38'; // internal brand id, from the site's own filter URL
const MODEL_RAV4 = 'RA';
const CARD = '[class*="UsedCarResultStyles__Wrapper"]';
const MAX_PAGES = 12;

/** Runs inside the page. Returns plain data — no DOM references escape. */
function extractCards(cardSelector) {
  return Array.from(document.querySelectorAll(cardSelector)).map((card) => {
    const pick = (sel) => card.querySelector(sel)?.textContent?.trim() || null;

    const specs = {};
    card.querySelectorAll('[class*="SpecListItem"]').forEach((item) => {
      const label = item.querySelector('[class*="SpecLabel"]')?.textContent?.trim();
      const value = item.querySelector('[class*="SpecValue"]')?.textContent?.trim();
      if (label) specs[label] = value || null;
    });

    return {
      title: pick('[class*="__Title"]'),
      subTitle: pick('[class*="SubTitle"]'),
      location: pick('[class*="__Location"]'),
      priceText: card.querySelector('[class*="__Prices"]')?.textContent?.replace(/\s+/g, ' ').trim() || null,
      url: card.querySelector('a[href*="/used-cars/"]')?.getAttribute('href') || null,
      specs,
      cardText: card.textContent.replace(/\s+/g, ' ').trim(),
    };
  });
}

/** "17 990,00 €35 185,38 лв." -> 17990 (the euro figure comes first) */
function parsePriceEur(text = '') {
  const match = String(text).replace(/ /g, ' ').match(/([\d\s]+)(?:,\d+)?\s*€/);
  return match ? toInt(match[1]) : null;
}

/** Toyota renders the year as "10-2023" (MM-YYYY). */
function parseYear(text = '') {
  const match = String(text).match(/(20\d{2})/);
  return match ? toInt(match[1]) : null;
}

function mapCard(card) {
  const titleLine = [card.title, card.subTitle].filter(Boolean).join(' ');
  // Detail links are absolute already, but be defensive about relative ones.
  const url = card.url && card.url.startsWith('/') ? `https://www.toyota.bg${card.url}` : card.url;

  return buildListing({
    // The detail URL slug is the only stable per-car identifier the grid exposes.
    adId: `toyota-${(url || titleLine).split('/').pop().split('?')[0]}`,
    title: titleLine || 'Toyota RAV4',
    brand: 'Toyota',
    model: titleLine,
    url,
    priceEur: parsePriceEur(card.priceText),
    year: parseYear(card.specs['Година'] || ''),
    mileageKm: toInt(card.specs['Пробег']),
    // See note 2 in the header: fuel spec can't tell PHEV from HEV.
    isPlugInHybrid: looksPlugInHybrid(titleLine),
    dealer: 'Toyota Approved Used',
    location: card.location,
    unavailable: isUnavailableText(card.cardText),
    sourceId: 'toyota',
  });
}

async function scrape() {
  return withPage(async (page) => {
    const url = `${BASE_URL}?brands=${BRAND_TOYOTA}&model=${MODEL_RAV4}`;
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    // Dismiss the cookie banner if present — it can overlay the pagination control.
    // Choosing "reject/necessary only" rather than accepting everything.
    for (const label of ['Отхвърли', 'Само необходими', 'Reject']) {
      const button = page.getByRole('button', { name: new RegExp(label, 'i') }).first();
      // eslint-disable-next-line no-await-in-loop
      if (await button.count().catch(() => 0)) {
        // eslint-disable-next-line no-await-in-loop
        await button.click({ timeout: 3000 }).catch(() => {});
        break;
      }
    }

    await page.waitForSelector(CARD, { timeout: 30000 }).catch(() => null);

    const collected = [];
    const seenUrls = new Set();

    for (let pageNo = 1; pageNo <= MAX_PAGES; pageNo += 1) {
      // eslint-disable-next-line no-await-in-loop
      const cards = await page.evaluate(extractCards, CARD);
      let added = 0;
      cards.forEach((card) => {
        const key = card.url || card.title;
        if (key && !seenUrls.has(key)) {
          seenUrls.add(key);
          collected.push(card);
          added += 1;
        }
      });

      const next = page.getByRole('button', { name: /Следваща страница/i }).first();
      // eslint-disable-next-line no-await-in-loop
      const hasNext = (await next.count().catch(() => 0)) > 0;
      // eslint-disable-next-line no-await-in-loop
      const enabled = hasNext ? await next.isEnabled().catch(() => false) : false;
      if (!enabled || added === 0) break;

      // eslint-disable-next-line no-await-in-loop
      await next.click().catch(() => {});
      // eslint-disable-next-line no-await-in-loop
      await page.waitForTimeout(1500); // grid re-renders in place; no navigation to await
    }

    return collected.map(mapCard);
  });
}

module.exports = {
  id: 'toyota',
  label: 'toyota.bg (Approved Used)',
  requiresBrowser: true,
  scrape,
  mapCard,
  parsePriceEur,
  parseYear,
};
