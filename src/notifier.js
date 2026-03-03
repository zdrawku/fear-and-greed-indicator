require('dotenv').config();
const axios = require('axios');
const notifier = require('node-notifier');
const cron = require('node-cron');
const { fetchGoldPrice } = require('./goldScraper');

const FandGindex_URL = `https://pro-api.coinmarketcap.com/v3/fear-and-greed/latest?CMC_PRO_API_KEY=${process.env.CMC_API_KEY}`;
const BTC_URL = `https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=BTC&CMC_PRO_API_KEY=${process.env.CMC_API_KEY}`;
const METALS_URL = `https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?id=39343,39344&CMC_PRO_API_KEY=${process.env.CMC_API_KEY}`;

const compact = (val) => Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(val);

// Function to fetch data and send notifications
async function fetchAndNotify() {
  try {
    const [fgResponse, btcResponse, metalsResponse, tavexData] = await Promise.all([
      axios.get(FandGindex_URL),
      axios.get(BTC_URL),
      axios.get(METALS_URL),
      fetchGoldPrice().catch(err => {
        console.warn('⚠️ Could not fetch Tavex gold price:', err.message);
        return null;
      }),
    ]);

    const fgData = fgResponse.data.data;
    const btcData = btcResponse.data.data.BTC;
    const quote = btcData.quote.USD;

    const fgValue = parseInt(fgData.value);
    const fgClass = fgData.value_classification;
    const fgUpdateTime = new Date(fgData.update_time).toUTCString();

    const BTCprice = Math.round(quote.price);
    const btcChange24h = quote.percent_change_24h.toFixed(2);
    const btcChange7d = quote.percent_change_7d.toFixed(2);
    const btcChange30d = quote.percent_change_30d.toFixed(2);
    const btcVolume24h = compact(quote.volume_24h);
    const btcVolumeChange24h = quote.volume_change_24h.toFixed(2);
    const btcMarketCap = compact(quote.market_cap);
    const marketCapDominance = quote.market_cap_dominance.toFixed(2);
    const circulatingSupply = Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(btcData.circulating_supply);
    const maxSupply = btcData.max_supply;

    // Gold (XAU) - ID 39344
    const goldQuote = metalsResponse.data.data['39344'].quote.USD;
    const GOLDprice = goldQuote.price.toFixed(2);
    const goldChange24h = goldQuote.percent_change_24h.toFixed(2);
    const goldChange7d = goldQuote.percent_change_7d.toFixed(2);
    const goldChange30d = goldQuote.percent_change_30d.toFixed(2);
    const goldVolume24h = compact(goldQuote.volume_24h);
    const goldVolumeChange24h = goldQuote.volume_change_24h.toFixed(2);
    const goldMarketCap = compact(goldQuote.fully_diluted_market_cap || goldQuote.market_cap);

    // Silver (XAG) - ID 39343
    const silverQuote = metalsResponse.data.data['39343'].quote.USD;
    const SILVERprice = silverQuote.price.toFixed(2);
    const silverChange24h = silverQuote.percent_change_24h.toFixed(2);
    const silverChange7d = silverQuote.percent_change_7d.toFixed(2);
    const silverChange30d = silverQuote.percent_change_30d.toFixed(2);
    const silverVolume24h = compact(silverQuote.volume_24h);
    const silverVolumeChange24h = silverQuote.volume_change_24h.toFixed(2);
    const silverMarketCap = compact(silverQuote.fully_diluted_market_cap || silverQuote.market_cap);

    let suggestion = '';
    if (fgValue <= 25) suggestion = '🧊 *Extreme fear!* Might be a buying opportunity.';
    else if (fgValue <= 40) suggestion = '😨 *Market fear detected* — consider buying.';
    else if (fgValue <= 55) suggestion = '😐 *Neutral zone.* Monitor the market.';
    else if (fgValue <= 70) suggestion = '🙂 *Moderate greed* — trade cautiously.';
    else suggestion = '🤑 *High greed!* Be cautious — consider taking profits.';

    // Build Tavex gold bar section
    let tavexSection = '';
    if (tavexData) {
      tavexSection = `\n🥇 *Gold 1g Bar (Tavex)*: ${tavexData.sellPrice} € (sell)`;
      if (tavexData.buybackPrice != null) {
        tavexSection += ` / ${tavexData.buybackPrice} € (buyback)`;
      }
      if (tavexData.spread != null) {
        tavexSection += `\n📊 Spread: ${tavexData.spread}%`;
      }
    }

    const message = `
📊 *Fear & Greed Index*: ${fgValue} — _${fgClass}_

💰 *Bitcoin Price*: $${BTCprice}
↔️ 24h: ${btcChange24h}% | 📈 7d: ${btcChange7d}% | 📅 30d: ${btcChange30d}%
🔄 Volume (24h): $${btcVolume24h} (${btcVolumeChange24h}%)
🏦 Market Cap: $${btcMarketCap}
🎯 Dominance: ${marketCapDominance}%
🔁 Circulating Supply: ${circulatingSupply} / ${maxSupply}
${tavexSection}

💡 ${suggestion}
------------------
🪙 *Gold Price*: $${GOLDprice}
↔️ 24h: ${goldChange24h}% | 📈 7d: ${goldChange7d}% | 📅 30d: ${goldChange30d}%
🔄 Volume (24h): $${goldVolume24h} (${goldVolumeChange24h}%)
🏦 Market Cap: $${goldMarketCap}

🥈 *Silver Price*: $${SILVERprice}
↔️ 24h: ${silverChange24h}% | 📈 7d: ${silverChange7d}% | 📅 30d: ${silverChange30d}%
🔄 Volume (24h): $${silverVolume24h} (${silverVolumeChange24h}%)
🏦 Market Cap: $${silverMarketCap}

`.trim();

    console.log(`${message} \n\nAt ${new Date().toLocaleString()}`);

    const tavexNotif = tavexData ? `, Tavex 1g: ${tavexData.sellPrice}€` : '';
    notifier.notify({
      title: 'Fear & Greed Alert',
      message: `F&G: ${fgValue} (${fgClass}), BTC: $${BTCprice}, XAU: $${GOLDprice}, XAG: $${SILVERprice}${tavexNotif}`,
      sound: true,
    });

    const telegramResponse = await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: process.env.TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: 'Markdown',
    });

    if (telegramResponse.status === 200 && telegramResponse.data.ok) {
      console.log('✅ Telegram message sent successfully');
    } else {
      console.warn('⚠️ Telegram API responded but message was not sent:', telegramResponse.data);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// For testing - Run once now to test
fetchAndNotify();