[![Run Fear & Greed Bot](https://github.com/zdrawku/fear-and-greed-indicator/actions/workflows/cron-job.yml/badge.svg)](https://github.com/zdrawku/fear-and-greed-indicator/actions/workflows/cron-job.yml)

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
``` 

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

---

# PHEV SUV Listing Notifier

A second, independent notifier living in the same repo. It watches six sources
for plug-in hybrid SUV listings and pings Telegram **only when a new ad appears**
— no message when nothing changed.

The Fear & Greed bot (`src/notifier.js`) is untouched and keeps its own schedule;
the two share nothing but `TELEGRAM_TOKEN` / `TELEGRAM_CHAT_ID`.

## What it looks for

| Criterion | Value |
|---|---|
| Models | Škoda Kodiaq, Toyota RAV4, Hyundai Santa Fe, Kia Sorento, BMW X5, Honda CR-V |
| Engine | Plug-in hybrid only |
| Year | 2022 or newer |
| Price | ≤ 35 000 € |
| Mileage | < 150 000 km (strict) |
| Location | Bulgaria |

Sold, reserved and deposited (`Капариран`) cars are filtered out.
All thresholds live in `src/carListings/config.js`.

## Sources — and why only one needs a browser

Each site was probed before writing a scraper. The result is that five of the six
are reachable without rendering, which keeps CI fast and the failure surface small.

| Source | Method | Notes |
|---|---|---|
| mobile.bg | axios + cheerio | Server-rendered. Two saved searches cover all six models. |
| skoda-auto.bg | axios (JSON API) | React app, but backed by a public unauthenticated JSON endpoint. |
| hyundai.bg | axios + cheerio | Ships the whole inventory as `li.hidden-car` with typed `data-*` attributes and filters client-side — so one plain GET returns everything. |
| kia.bg | axios + cheerio | Server-rendered. ⚠️ Outlet was empty when written; selectors unverified against live stock. |
| cars.honda.bg | axios + cheerio | WordPress. Scrapes `/s-probeg/` (used) only — `/avtomobili-na-sklad/` is new stock, out of scope. ⚠️ Also empty when written. |
| toyota.bg | **Playwright** | Genuinely client-rendered: no hydration payload, no public API. The only source needing a browser. |

Two markup quirks worth knowing about, both handled in code:

- **Toyota's "Гориво" spec says `Хибрид Бензин` for plug-in hybrids too** — it
  does not distinguish PHEV from HEV. The only reliable signal is the trim line
  in the title (`2.5 Plug-In Hybrid Style AWD`), so that's what's tested.
- **Toyota's class names are styled-components hashes** (`...-sc-nmyu5z-0`) that
  change on every deploy, so selectors match the stable prefix via `[class*=...]`.

## Usage

```bash
npm test                            # 86 offline tests, no network needed
node src/carNotifier.js             # check, notify on changes, save state
node src/carNotifier.js --dry-run   # print the message, don't send, don't save
node src/carNotifier.js --always    # send even when nothing changed
node src/carNotifier.js --only=skoda,hyundai   # restrict to specific sources
```

Playwright needs its browser binary once: `npx playwright install chromium`.
If it's missing, only the Toyota source fails — the other five still run.

## How the "new ad" detection works

Every listing gets a stable `adId` (mobile.bg's `div.item` id, Škoda's stock id,
Hyundai's `data-car_id`, Toyota's detail-URL slug). After a run the matching ids
are written to `data/seen-listings.json`; the next run diffs against that file.

In GitHub Actions the state file is committed back to the repo after each run —
that's what makes the diff survive on ephemeral runners.

**Failure handling is deliberate.** A source that throws is logged and skipped so
one broken dealer site can't cost you the mobile.bg results — but on a partial
run the state file is **not** written and removals are **not** reported. Otherwise
a transient outage would look like "all those cars sold", and they'd be
re-announced as new on the next healthy run. If every source fails, the run aborts.

## Schedule

`.github/workflows/car-listings-cron.yml` runs at `0 5,15 * * *` UTC = 08:00 and
18:00 Bulgarian summer time. GitHub Actions cron is always UTC, so in winter
(EET) these shift to 07:00 / 17:00.

## Module layout

```
src/carNotifier.js                   entry point: scrape → filter → diff → notify
src/carListings/config.js            criteria, wanted models, per-source toggles
src/carListings/criteria.js          the single "do I want this car?" decision
src/carListings/normalize.js         shared parsing + canonical listing shape
src/carListings/store.js             state load/save + diff
src/carListings/formatMessage.js     Telegram message rendering
src/carListings/browser.js           lazy Playwright wrapper
src/carListings/sources/*.js         one module per site
data/seen-listings.json              persisted state (committed by CI)
test/run-tests.js                    offline tests against captured fixtures
```

## Adding a source

Export `{ id, label, requiresBrowser, scrape() }` where `scrape()` resolves to
listings built via `buildListing()` from `normalize.js`, then register it in
`sources/index.js` and add a toggle in `SOURCE_SETTINGS`. Filtering, diffing and
formatting all work unchanged.

Note that `buildListing()` sets `model` to `null` unless the car matches one of
`WANTED_MODELS` — that null is the model gate in `criteria.js`, so don't
"helpfully" fall back to the raw model name.

---

## License
This project is licensed under the MIT License. See the LICENSE file for details.
