require('dotenv').config();
const axios = require('axios');
const notifier = require('node-notifier');
const cron = require('node-cron');

const FandGindex_URL = `https://pro-api.coinmarketcap.com/v3/fear-and-greed/latest?CMC_PRO_API_KEY=${process.env.CMC_API_KEY}`;
const BTC_URL = `https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=BTC&CMC_PRO_API_KEY=${process.env.CMC_API_KEY}`;

// Function to fetch data and send notifications
async function fetchAndNotify() {
  try {
    const fgResponse = await axios.get(FandGindex_URL);
    const btcResponse = await axios.get(BTC_URL);

    const fgData = fgResponse.data.data;
    const btcData = btcResponse.data.data.BTC;
    const quote = btcData.quote.USD;

    const fgValue = parseInt(fgData.value);
    const fgClass = fgData.value_classification;
    const fgUpdateTime = new Date(fgData.update_time).toUTCString();

    const BTCprice = Math.round(quote.price);
    const change24h = quote.percent_change_24h.toFixed(2);
    const change7d = quote.percent_change_7d.toFixed(2);
    const change30d = quote.percent_change_30d.toFixed(2);

    const volume24h = Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(quote.volume_24h);
    const volumeChange24h = quote.volume_change_24h.toFixed(2);
    const marketCap = Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(quote.market_cap);
    const marketCapDominance = quote.market_cap_dominance.toFixed(2);
    const circulatingSupply = Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(btcData.circulating_supply);
    const maxSupply = btcData.max_supply;
    const btcUpdateTime = new Date(quote.last_updated).toUTCString();

    let suggestion = '';
    if (fgValue <= 25) suggestion = '🧊 *Extreme fear!* Might be a buying opportunity.';
    else if (fgValue <= 40) suggestion = '😨 *Market fear detected* — consider buying.';
    else if (fgValue <= 55) suggestion = '😐 *Neutral zone.* Monitor the market.';
    else if (fgValue <= 70) suggestion = '🙂 *Moderate greed* — trade cautiously.';
    else suggestion = '🤑 *High greed!* Be cautious — consider taking profits.';

    const message = `
📊 *Fear & Greed Index*: ${fgValue} — _${fgClass}_

💰 *Bitcoin Price*: $${BTCprice}
↔️ 24h: ${change24h}% | 📈 7d: ${change7d}% | 📅 30d: ${change30d}%
🔄 Volume (24h): $${volume24h} (${volumeChange24h}%)
🏦 Market Cap: $${marketCap}
🎯 Dominance: ${marketCapDominance}%
🔁 Circulating Supply: ${circulatingSupply} / ${maxSupply}

💡 ${suggestion}
`.trim();

    console.log(`${message} \n\nAt ${new Date().toLocaleString()}`);

    notifier.notify({
      title: 'Fear & Greed Alert',
      message: `Fear & Greed: ${fgValue} (${fgClass}), BTC: $${BTCprice}`,
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

// Schedule the cron job normally
// Runs at 9 AM, 12 PM, 6 PM, 8 PM, and 11 PM every day
// cron.schedule('0 9,12,18,20,23 * * *', fetchAndNotify);
