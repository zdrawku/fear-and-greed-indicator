const fs = require('fs');
const path = require('path');

/**
 * Persistence for "which ads have I already reported?".
 *
 * The state file is committed back to the repo by the GitHub Actions workflow,
 * which is what makes the diff survive between runs on ephemeral CI runners.
 * Locally it just sits in data/ and is read/written in place.
 */

const STATE_PATH = path.join(__dirname, '..', '..', 'data', 'seen-listings.json');

function loadState() {
  try {
    const raw = fs.readFileSync(STATE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      lastCheck: parsed.lastCheck || null,
      listings: Array.isArray(parsed.listings) ? parsed.listings : [],
    };
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.warn(`⚠️ Could not read state file (${err.message}) — treating as first run.`);
    }
    return { lastCheck: null, listings: [] };
  }
}

function saveState(listings) {
  const payload = {
    lastCheck: new Date().toISOString(),
    listings,
  };
  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
  fs.writeFileSync(STATE_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return payload;
}

/**
 * Splits the current scrape against the previous state.
 * @returns {{isFirstRun: boolean, newListings: object[], stillAvailable: object[], goneListings: object[]}}
 */
function diffAgainstState(currentListings, previousState) {
  const previousIds = new Set(previousState.listings.map((l) => l.adId));
  const currentIds = new Set(currentListings.map((l) => l.adId));

  return {
    isFirstRun: previousState.lastCheck === null,
    newListings: currentListings.filter((l) => !previousIds.has(l.adId)),
    stillAvailable: currentListings.filter((l) => previousIds.has(l.adId)),
    goneListings: previousState.listings.filter((l) => !currentIds.has(l.adId)),
  };
}

module.exports = { loadState, saveState, diffAgainstState, STATE_PATH };
