# Fear and Greed Indicator Notifier

This project fetches the Fear & Greed Index and Bitcoin price data from the CoinMarketCap API and sends notifications via desktop and Telegram. It also schedules periodic notifications using a cron job.

## Features

- Fetches the Fear & Greed Index and Bitcoin price from the CoinMarketCap API.
- Sends desktop notifications using `node-notifier`.
- Sends Telegram messages to a specified chat.
- Schedules notifications at specific times using `node-cron`.

## Prerequisites

Before running the project, ensure you have the following:

1. **Node.js** installed on your system.
2. A valid **CoinMarketCap API key**.
3. A **Telegram bot token** and **chat ID**.

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-repo/fear-and-greed-indicator.git
   cd fear-and-greed-indicator
2. Install dependencies:
```
npm i
```
3. Create a .env file in the root directory and add the following environment variables:
```
CMC_API_KEY=your_coinmarketcap_api_key
TELEGRAM_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_telegram_chat_id
```

## Usage
Run the script to test notifications:

```
node src/notifier.js
```

The script will:

- Fetch the Fear & Greed Index and Bitcoin price.
- Send a desktop notification.
- Send a Telegram message.

The cron job is scheduled to run at the following times every day:

- 9:00 AM
- 12:00 PM
- 6:00 PM
- 8:00 PM
- 11:00 PM

## Dependencies
- dotenv: For managing environment variables.
- axios: For making HTTP requests.
- node-notifier: For sending desktop notifications.
- node-cron: For scheduling tasks.

## Notes

Ensure your CoinMarketCap API key has the necessary permissions to access the required endpoints.
Make sure your Telegram bot has access to the specified chat.

## License
This project is licensed under the MIT License. See the LICENSE file for details.

Replace placeholders like `your_coinmarketcap_api_key`, `your_telegram_bot_token`, and `your_telegram_chat_id` with actual values in your .env file.