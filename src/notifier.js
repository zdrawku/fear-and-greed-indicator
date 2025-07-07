require('dotenv').config();
const axios = require('axios');
const notifier = require('node-notifier');
const cron = require('node-cron');
const FandGindex_URL = `https://pro-api.coinmarketcap.com/v3/fear-and-greed/latest?CMC_PRO_API_KEY=${process.env.CMC_API_KEY}`;
const BTC_URL = `https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=BTC&CMC_PRO_API_KEY=${process.env.CMC_API_KEY}`;

// Function to fetch data and send notifications
async function fetchAndNotify() {
  try {
    const api1Response = await axios.get(FandGindex_URL);
    const api2Response = await axios.get(BTC_URL);
    const value = parseInt(api1Response.data.data.value);
    const BTCvalue = Math.round(api2Response.data.data.BTC.quote.USD.price);

    const message = `Fear & Greed Index is ${value} and Bitcoin price is $${BTCvalue}. Buy Bitcoin if between 25 and 40!!!`;
    console.log(`${ message } At ${ new Date().toLocaleString() }`);

    notifier.notify({
      title: 'Fear & Greed Alert',
      message: message,
      sound: true,
    });

    const telegramResponse = await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: process.env.TELEGRAM_CHAT_ID,
      text: message,
    });

    if (telegramResponse.status === 200 && telegramResponse.data.ok) {
      console.log('Telegram message sent successfully');
    } else {
      console.warn('Telegram API responded but message was not sent:', telegramResponse.data);
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// For testing - Run once now to test
// fetchAndNotify();

// Schedule the cron job normally
// Runs at 9 AM, 12 PM, 6 PM, 8 PM, and 11 PM every day
cron.schedule('0 9,12,18,20,23 * * *', fetchAndNotify);
