const { SOURCE_SETTINGS } = require('../config');

const mobileBg = require('./mobileBg');
const skoda = require('./skoda');
const hyundai = require('./hyundai');
const kia = require('./kia');
const honda = require('./honda');
const toyota = require('./toyota');

const ALL_SOURCES = [mobileBg, skoda, hyundai, kia, honda, toyota];

/** Sources the user hasn't switched off in config.js. */
function enabledSources() {
  return ALL_SOURCES.filter((source) => SOURCE_SETTINGS[source.id]?.enabled !== false);
}

module.exports = { ALL_SOURCES, enabledSources };
