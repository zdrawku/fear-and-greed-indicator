/**
 * Lazy Playwright wrapper.
 *
 * Playwright is only needed by one source (Toyota), so it is required at call
 * time rather than at module load. That keeps the whole thing runnable — and the
 * other five sources working — on a machine where Playwright isn't installed or
 * its browser binaries were never downloaded.
 */

let chromiumRef = null;

function loadChromium() {
  if (chromiumRef) return chromiumRef;
  try {
    // eslint-disable-next-line global-require
    ({ chromium: chromiumRef } = require('playwright'));
    return chromiumRef;
  } catch (err) {
    throw new Error(
      'Playwright не е инсталиран. Изпълни `npm install` и `npx playwright install chromium`, ' +
        'или изключи източниците с requiresBrowser в config.js (SOURCE_SETTINGS).'
    );
  }
}

/**
 * Opens a page, hands it to `fn`, and always tears the browser down afterwards.
 * @param {(page: import('playwright').Page) => Promise<T>} fn
 * @returns {Promise<T>}
 */
async function withPage(fn, { timeoutMs = 45000 } = {}) {
  const chromium = loadChromium();
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });

  try {
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      locale: 'bg-BG',
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();
    page.setDefaultTimeout(timeoutMs);

    // Images and fonts are pure weight for a scraper; skipping them roughly
    // halves the load time and the memory footprint on a CI runner.
    await page.route('**/*', (route) => {
      const type = route.request().resourceType();
      if (type === 'image' || type === 'font' || type === 'media') return route.abort();
      return route.continue();
    });

    return await fn(page);
  } finally {
    await browser.close();
  }
}

module.exports = { withPage };
