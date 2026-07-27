require('dotenv').config();
const axios = require('axios');

const { enabledSources } = require('./carListings/sources');
const { applyCriteria } = require('./carListings/criteria');
const { loadState, saveState, diffAgainstState } = require('./carListings/store');
const { buildMessage } = require('./carListings/formatMessage');

/** `--always` forces a message even when nothing changed (handy for testing). */
const ALWAYS_SEND = process.argv.includes('--always');
/** `--dry-run` prints the message instead of sending it and skips the state write. */
const DRY_RUN = process.argv.includes('--dry-run');
/** `--only=skoda,hyundai` restricts the run to specific sources. */
const ONLY = (process.argv.find((a) => a.startsWith('--only=')) || '').replace('--only=', '');

function selectSources() {
  const sources = enabledSources();
  if (!ONLY) return sources;
  const wanted = ONLY.split(',').map((s) => s.trim()).filter(Boolean);
  return sources.filter((source) => wanted.includes(source.id));
}

/**
 * Runs every source. A source that throws is logged and skipped rather than
 * aborting the run — one dealer site changing its markup shouldn't cost us the
 * mobile.bg results. But if *every* source fails we bail without touching state,
 * so a total outage can't be misread as "all the cars disappeared".
 */
async function collectListings(sources) {
  const outcomes = await Promise.all(
    sources.map(async (source) => {
      const startedAt = Date.now();
      try {
        const listings = await source.scrape();
        const ms = Date.now() - startedAt;
        console.log(`✅ ${source.label}: ${listings.length} обяви (${ms} ms)`);
        return { ok: true, listings };
      } catch (err) {
        console.error(`❌ ${source.label}: ${err.message}`);
        return { ok: false, listings: [] };
      }
    })
  );

  if (outcomes.every((o) => !o.ok)) {
    throw new Error('Всички източници се провалиха — прекратявам без промяна на състоянието.');
  }

  const failed = outcomes.filter((o) => !o.ok).length;
  if (failed > 0) {
    console.warn(`⚠️ ${failed} от ${sources.length} източника се провалиха — резултатът е непълен.`);
  }

  // Deduplicate: the same car can appear in two mobile.bg saved searches, and a
  // dealer car can show up both on the dealer site and on mobile.bg.
  const byId = new Map();
  outcomes.flatMap((o) => o.listings).forEach((listing) => {
    if (!byId.has(listing.adId)) byId.set(listing.adId, listing);
  });

  return { listings: [...byId.values()], partial: failed > 0 };
}

async function sendTelegram(text) {
  const { TELEGRAM_TOKEN, TELEGRAM_CHAT_ID } = process.env;
  if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) {
    console.warn('⚠️ Липсва TELEGRAM_TOKEN или TELEGRAM_CHAT_ID — пропускам изпращането.');
    return;
  }

  const response = await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    chat_id: TELEGRAM_CHAT_ID,
    text,
    parse_mode: 'Markdown',
    disable_web_page_preview: true,
  });

  if (response.status === 200 && response.data.ok) {
    console.log('✅ Telegram съобщението е изпратено');
  } else {
    console.warn('⚠️ Telegram отговори, но съобщението не беше изпратено:', response.data);
  }
}

async function run() {
  const sources = selectSources();
  console.log(`🔎 Източници: ${sources.map((s) => s.id).join(', ') || '(няма)'}\n`);

  const { listings: scraped, partial } = await collectListings(sources);

  const matching = [];
  const rejected = [];
  scraped.forEach((listing) => {
    const { passes, reasons } = applyCriteria(listing);
    if (passes) matching.push(listing);
    else rejected.push({ title: listing.title, sourceId: listing.sourceId, reasons });
  });

  console.log(`\n📊 ${matching.length} отговарят на критериите, ${rejected.length} отпаднаха`);
  // Only show near-misses; "not a wanted model" is the overwhelming majority and
  // is just noise (a Hyundai i20, a Toyota Yaris) rather than something to review.
  rejected
    .filter((r) => !r.reasons.includes('not a wanted model'))
    .forEach((r) => console.log(`   – [${r.sourceId}] ${r.title}: ${r.reasons.join('; ')}`));

  const previousState = loadState();
  const diff = diffAgainstState(matching, previousState);

  console.log(
    `\n🔁 нови: ${diff.newListings.length} | останали: ${diff.stillAvailable.length} | свалени: ${diff.goneListings.length}${diff.isFirstRun ? ' (първо изпълнение)' : ''}`
  );

  const message = buildMessage(diff, { alwaysSend: ALWAYS_SEND, partial });

  if (!message) {
    console.log('😴 Няма промени — не изпращам съобщение.');
  } else if (DRY_RUN) {
    console.log(`\n--- DRY RUN ---\n${message}\n---------------`);
  } else {
    await sendTelegram(message);
  }

  if (DRY_RUN) {
    console.log('🧪 Dry run — състоянието не е записано.');
  } else if (partial) {
    // Writing a partial scrape would make the missing source's cars look "sold",
    // and they'd then be re-announced as "new" on the next healthy run.
    console.log('⏭️ Непълен резултат — състоянието НЕ е записано, за да не се загубят обяви.');
  } else {
    saveState(matching);
    console.log('💾 Състоянието е записано.');
  }
}

run().catch((err) => {
  console.error('❌ Грешка:', err.message);
  process.exit(1);
});
