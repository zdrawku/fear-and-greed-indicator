const axios = require('axios');
const cheerio = require('cheerio');

const TAVEX_URL = 'https://tavex.bg/zlato/1-gram-abonamentno-zlatno-kulche-tavex/';

/**
 * Fetches the current price of the 1g gold bar from Tavex.
 * Extracts the `data-pricelist` JSON attribute embedded in the product page HTML.
 *
 * @returns {Promise<{sellPrice: number, buybackPrice: number, spread: string, currency: string}>}
 */
async function fetchGoldPrice() {
    const { data: html } = await axios.get(TAVEX_URL, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'bg,en;q=0.9',
        },
    });

    const $ = cheerio.load(html);

    // Primary method: extract structured JSON from data-pricelist attribute
    const pricelistRaw = $('.product-poster__price-value').attr('data-pricelist');

    if (pricelistRaw) {
        const priceData = JSON.parse(pricelistRaw);
        const sellPrice = priceData.sell?.[0]?.price;
        const buybackPrice = priceData.buy?.[0]?.price;

        if (sellPrice != null && buybackPrice != null) {
            const spread = (((sellPrice - buybackPrice) / sellPrice) * 100).toFixed(2);
            return {
                sellPrice,
                buybackPrice,
                spread,
                currency: 'EUR',
            };
        }
    }

    // Fallback: extract from JSON-LD structured data (sell price only)
    const jsonLdScripts = $('script[type="application/ld+json"]');
    for (let i = 0; i < jsonLdScripts.length; i++) {
        try {
            const ld = JSON.parse($(jsonLdScripts[i]).html());
            if (ld['@type'] === 'Product' && ld.offers) {
                const offer = Array.isArray(ld.offers) ? ld.offers[0] : ld.offers;
                return {
                    sellPrice: parseFloat(offer.price),
                    buybackPrice: null,
                    spread: null,
                    currency: offer.priceCurrency || 'EUR',
                };
            }
        } catch {
            // skip malformed JSON-LD blocks
        }
    }

    throw new Error('Could not extract gold price from Tavex page');
}

module.exports = { fetchGoldPrice };
