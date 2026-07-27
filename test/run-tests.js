/* eslint-disable no-console */
/**
 * Dependency-free test runner for the car-listing notifier.
 *
 * These are offline tests: every fixture below is real markup/JSON captured from
 * the live sites, so parsing can be verified without hitting the network on
 * every run. Run with `npm test`.
 */

let passed = 0;
let failed = 0;

function check(condition, label, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${label}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

function group(name, fn) {
  console.log(`\n${name}`);
  fn();
}

// ---------------------------------------------------------------- normalize
const { toInt, looksPlugInHybrid, matchWantedModel } = require('../src/carListings/normalize');

group('normalize', () => {
  check(toInt('40 406') === 40406, 'toInt strips spaces');
  check(toInt('40 406') === 40406, 'toInt strips non-breaking spaces');
  check(toInt(22500) === 22500, 'toInt passes numbers through');
  check(toInt('') === null, 'toInt returns null for empty');
  check(toInt(null) === null, 'toInt returns null for null');

  check(looksPlugInHybrid('Plug-in хибрид (Бензин/Електрически)') === true, 'detects Škoda fuel string');
  check(looksPlugInHybrid('Плъгин хибрид') === true, 'detects Bulgarian "Плъгин"');
  check(looksPlugInHybrid('2.5 Plug-In Hybrid Style AWD') === true, 'detects Toyota trim line');
  check(looksPlugInHybrid('Хибрид Бензин') === false, 'rejects plain hybrid');
  check(looksPlugInHybrid('Бензин') === false, 'rejects petrol');

  check(matchWantedModel('HYUNDAI SANTA FE')?.model === 'Santa Fe', 'matches SANTA FE uppercase');
  check(matchWantedModel('Hyundai Santa-Fe 1.6')?.model === 'Santa Fe', 'matches hyphenated Santa-Fe');
  check(matchWantedModel('Toyota Rav4 Prime XSE')?.model === 'RAV4', 'matches Rav4');
  check(matchWantedModel('Honda CR-V e:PHEV')?.model === 'CR-V', 'matches CR-V');
  check(matchWantedModel('Škoda Octavia Estate') === null, 'rejects Octavia');
  check(matchWantedModel('HYUNDAI i20 BUSINESS') === null, 'rejects i20');
});

// ---------------------------------------------------------------- mobile.bg
const mobileBg = require('../src/carListings/sources/mobileBg');

const MOBILE_BG_FIXTURE = `
<div class="ads2023">
  <div class="item VIP " id="ida21775491484749803">
    <div class="photo"><div class="wrapper"><div class="big">
      <a class="image saveSlink" href="//www.mobile.bg/obiava-21775491484749803-bmw-x5"></a>
    </div></div></div>
    <div class="text">
      <div class="zaglavie">
        <a class="title saveSlink" href="//www.mobile.bg/obiava-21775491484749803-bmw-x5">BMW X5 Xdrive 45e/High Ex/ОФЕРТА</a>
        <div class="price">31 990 €62 567.00 лв. Цената е с включено ДДС</div>
      </div>
      <div class="params">септември 2022 г.  200 000 км Черен Plug-in хибрид 394 к.с. Евро 6 24 kWh Автоматична Джип</div>
      <div class="seller"><div class="sInfo">
        <div class="name">PrimeAutos</div><div class="location">обл. София, гр. София</div>
      </div></div>
    </div>
  </div>
  <div class="item" id="ida21774535121245676">
    <div class="text">
      <div class="zaglavie">
        <a class="title saveSlink" href="//www.mobile.bg/obiava-21774535121245676-kia-sorento">Kia Sorento Plug-in Хибрид</a>
        <div class="price">25 500 €49 873.67 лв. Не се начислява ДДС</div>
      </div>
      <div class="params">септември 2022 г. 65 000 км Сив Plug-in хибрид 265 к.с. Евро 6 13 kWh Автоматична Джип</div>
      <div class="seller"><div class="sInfo">
        <div class="name">ИАРДЖИ 12</div><div class="location">обл. Пловдив, гр. Пловдив</div>
      </div></div>
    </div>
  </div>
  <div class="item" id="ida21779643068322186">
    <div class="text">
      <div class="zaglavie">
        <a class="title saveSlink" href="//www.mobile.bg/obiava-21779643068322186-kia-sorento">Kia Sorento ПРОДАДЕНА !!!</a>
        <div class="price">25 444 €49 764.14 лв.</div>
      </div>
      <div class="params">април 2022 г. 153 700 км Бордо Plug-in хибрид 265 к.с. Автоматична Джип</div>
      <div class="seller"><div class="sInfo"><div class="name">ETIKA AUTO</div><div class="location">обл. Пазарджик</div></div></div>
    </div>
  </div>
</div>`;

group('mobile.bg parser', () => {
  const rows = mobileBg.parseSearchHtml(MOBILE_BG_FIXTURE, 'test');
  check(rows.length === 3, 'parses all three items', `got ${rows.length}`);

  const bmw = rows[0];
  check(bmw.adId === '21775491484749803', 'extracts adId from element id');
  check(bmw.url === 'https://www.mobile.bg/obiava-21775491484749803-bmw-x5', 'upgrades protocol-relative href');
  check(bmw.priceEur === 31990, 'parses price', String(bmw.priceEur));
  check(bmw.year === 2022, 'parses year', String(bmw.year));
  check(bmw.mileageKm === 200000, 'parses mileage after Cyrillic "км"', String(bmw.mileageKm));
  check(bmw.isPlugInHybrid === true, 'flags plug-in hybrid');
  check(bmw.brand === 'BMW' && bmw.model === 'X5', 'maps to BMW X5');
  check(bmw.dealer === 'PrimeAutos', 'reads dealer');
  check(bmw.unavailable === false, 'available ad not flagged');

  const kia = rows[1];
  check(kia.priceEur === 25500 && kia.mileageKm === 65000, 'parses second item');
  check(kia.brand === 'Kia' && kia.model === 'Sorento', 'maps to Kia Sorento');

  check(rows[2].unavailable === true, 'flags ПРОДАДЕНА as unavailable');
});

// ---------------------------------------------------------------- Škoda
const skoda = require('../src/carListings/sources/skoda');

const SKODA_CAR = {
  id: 'BGR03201NX53VC',
  model: 'Octavia Estate',
  title: 'SE',
  subTitle: null,
  salePrice: { unit: 'EUR', value: 22500 },
  mileage: { unit: 'км', value: '40 406' },
  initialReg: '2022-08-11T00:00:00Z',
  modelYear: 2023,
  technicalData: { fuel: 'Plug-in хибрид (Бензин/Електрически)', gear: 'Автоматична' },
  dealer: { name: '04-ŠKODA Център Пловдив', city: 'Пловдив' },
  isReserved: false,
};

const SKODA_KODIAQ = {
  ...SKODA_CAR,
  id: 'BGR0TESTKODIAQ',
  model: 'Kodiaq',
  salePrice: { unit: 'EUR', value: 33000 },
  mileage: { unit: 'км', value: '80 000' },
  isReserved: true,
};

group('Škoda API mapper', () => {
  const octavia = skoda.mapCar(SKODA_CAR);
  check(octavia.priceEur === 22500, 'reads salePrice.value');
  check(octavia.mileageKm === 40406, 'reads mileage with space separator');
  check(octavia.year === 2022, 'prefers initialReg year over modelYear', String(octavia.year));
  check(octavia.isPlugInHybrid === true, 'detects plug-in from technicalData.fuel');
  check(octavia.url === 'https://www.skoda-auto.bg/apps/stock/carDetail/BGR03201NX53VC', 'builds detail URL');
  check(octavia.model === null, 'Octavia is not a wanted model');
  check(octavia.dealer === '04-ŠKODA Център Пловдив', 'reads dealer name');

  const kodiaq = skoda.mapCar(SKODA_KODIAQ);
  check(kodiaq.model === 'Kodiaq' && kodiaq.brand === 'Skoda', 'Kodiaq is a wanted model');
  check(kodiaq.unavailable === true, 'isReserved maps to unavailable');
});

// ---------------------------------------------------------------- Hyundai
const hyundai = require('../src/carListings/sources/hyundai');

const HYUNDAI_FIXTURE = `
<ul>
  <li class="hidden-car" data-car_id="31597" data-manufacturer_level1_value="HYUNDAI"
      data-model_level2_value="I20" data-fueltype_value="Бензин"
      data-regdate_value="20250806" data-mileage_value="10 800" data-price_value="17700">
    <div class="info"><h3>HYUNDAI i20</h3><a class="details" href="https://hyundai.bg/upotrebyavani-avtomobili/hyundai-i20-business/">Детайли</a></div>
  </li>
  <li class="hidden-car" data-car_id="31601" data-manufacturer_level1_value="HYUNDAI"
      data-model_level2_value="SANTA FE" data-fueltype_value="Плъгин хибрид"
      data-regdate_value="20220125" data-mileage_value="122 000" data-price_value="40900">
    <div class="top-badges">РЕЗЕРВИРАН</div>
    <div class="info"><h3>HYUNDAI SANTA FE</h3><a class="details" href="https://hyundai.bg/upotrebyavani-avtomobili/santa-fe-premium/">Детайли</a></div>
  </li>
  <li class="hidden-car" data-car_id="31999" data-manufacturer_level1_value="HYUNDAI"
      data-model_level2_value="SANTA FE" data-fueltype_value="Плъгин хибрид"
      data-regdate_value="20230415" data-mileage_value="70 500" data-price_value="33000">
    <div class="info"><h3>HYUNDAI SANTA FE</h3><a class="details" href="https://hyundai.bg/upotrebyavani-avtomobili/santa-fe-lux/">Детайли</a></div>
  </li>
</ul>`;

group('Hyundai parser', () => {
  const rows = hyundai.parseListingHtml(HYUNDAI_FIXTURE);
  check(rows.length === 3, 'parses all cards including non-target ones', `got ${rows.length}`);

  const i20 = rows[0];
  check(i20.model === null, 'i20 is not a wanted model');
  check(i20.isPlugInHybrid === false, 'petrol not flagged as plug-in');

  const reserved = rows[1];
  check(reserved.model === 'Santa Fe', 'maps SANTA FE to Santa Fe');
  check(reserved.year === 2022, 'derives year from regdate YYYYMMDD', String(reserved.year));
  check(reserved.mileageKm === 122000, 'reads mileage data attribute');
  check(reserved.priceEur === 40900, 'reads price data attribute');
  check(reserved.isPlugInHybrid === true, 'detects "Плъгин хибрид"');
  check(reserved.unavailable === true, 'РЕЗЕРВИРАН badge flags unavailable');
  check(reserved.url.includes('santa-fe-premium'), 'reads details link');

  check(rows[2].unavailable === false, 'card without badge stays available');
});

// ---------------------------------------------------------------- Toyota
const toyota = require('../src/carListings/sources/toyota');

group('Toyota mapper', () => {
  check(toyota.parsePriceEur('17 990,00 €35 185,38 лв.') === 17990, 'takes euro figure, not BGN');
  check(toyota.parsePriceEur('41 000,00 €80 189,03 лв.') === 41000, 'parses larger price');
  check(toyota.parseYear('10-2023') === 2023, 'parses MM-YYYY');

  const phev = toyota.mapCard({
    title: 'Toyota RAV4',
    subTitle: '2.5 Plug-In Hybrid Style AWD',
    location: 'Велико Търново',
    priceText: '41 000,00 €80 189,03 лв.',
    url: 'https://www.toyota.bg/used-cars/pdp.toyota-rav4-2022-abc123',
    specs: { 'Година': '10-2022', 'Пробег': '39 625 км', 'Гориво': 'Хибрид Бензин' },
    cardText: 'Toyota RAV4 2.5 Plug-In Hybrid Style AWD',
  });
  check(phev.isPlugInHybrid === true, 'detects PHEV from trim despite "Хибрид Бензин" fuel spec');
  check(phev.mileageKm === 39625, 'parses mileage', String(phev.mileageKm));
  check(phev.year === 2022, 'parses year from MM-YYYY spec');
  check(phev.priceEur === 41000, 'parses price');
  check(phev.model === 'RAV4', 'maps to RAV4');
  check(phev.adId === 'toyota-pdp.toyota-rav4-2022-abc123', 'derives stable id from URL slug');

  const hev = toyota.mapCard({
    title: 'Toyota RAV4',
    subTitle: '2.5 HEV AWD',
    location: 'Сливен',
    priceText: '26 900,00 €52 611,83 лв.',
    url: 'https://www.toyota.bg/used-cars/pdp.toyota-rav4-2022-hev',
    specs: { 'Година': '05-2022', 'Пробег': '164 952 км', 'Гориво': 'Бензин' },
    cardText: 'Toyota RAV4 2.5 HEV AWD',
  });
  check(hev.isPlugInHybrid === false, 'plain HEV not flagged as plug-in');
});

// ---------------------------------------------------------------- Kia / Honda
const kia = require('../src/carListings/sources/kia');
const honda = require('../src/carListings/sources/honda');

group('Kia / Honda fail-soft parsers', () => {
  const empty = kia.parseOutletHtml('<div class="products"><p class="js-msg products__msg">Няма намерени резултати със зададените критерии.</p></div>');
  check(Array.isArray(empty) && empty.length === 0, 'Kia returns [] on "no results" page');

  const showcase = kia.parseOutletHtml('<li class="products__list-item"><div class="product__title">EV3</div>Цена от: 34 666 €</li>');
  check(showcase.length === 0, 'Kia ignores "Цена от:" model showcase cards');

  check(Array.isArray(kia.parseOutletHtml('<html><body>unexpected markup</body></html>')), 'Kia never throws on unknown markup');
  check(honda.parseUsedHtml('<html><body>empty</body></html>').length === 0, 'Honda returns [] on empty page');
});

// ---------------------------------------------------------------- criteria
const { applyCriteria } = require('../src/carListings/criteria');

const base = {
  model: 'Santa Fe', brand: 'Hyundai', unavailable: false,
  isPlugInHybrid: true, year: 2022, priceEur: 30000, mileageKm: 100000,
};
const withField = (patch) => ({ ...base, ...patch });

group('criteria', () => {
  const cases = [
    [withField({}), true, 'baseline passes'],
    [withField({ mileageKm: 149999 }), true, '149 999 km accepted'],
    [withField({ mileageKm: 150000 }), false, 'exactly 150 000 km rejected (strict)'],
    [withField({ mileageKm: 200000 }), false, '200 000 km rejected'],
    [withField({ mileageKm: null }), false, 'unknown mileage rejected'],
    [withField({ priceEur: 35000 }), true, 'exactly at price cap accepted'],
    [withField({ priceEur: 35001 }), false, 'over price cap rejected'],
    [withField({ year: 2021 }), false, '2021 rejected'],
    [withField({ year: 2022 }), true, '2022 accepted'],
    [withField({ isPlugInHybrid: false }), false, 'non-PHEV rejected'],
    [withField({ unavailable: true }), false, 'sold/reserved rejected'],
    [withField({ model: null }), false, 'non-target model rejected'],
  ];

  cases.forEach(([listing, expected, label]) => {
    const result = applyCriteria(listing);
    check(result.passes === expected, label, result.reasons.join('; '));
  });
});

// ---------------------------------------------------------------- diff + message
const { diffAgainstState } = require('../src/carListings/store');
const { buildMessage } = require('../src/carListings/formatMessage');

const listing = (adId, brand, title) => ({
  adId, brand, model: brand, title,
  url: `https://example.com/${adId}`,
  year: 2022, mileageKm: 65000, priceEur: 28900,
  dealer: 'Dealer', location: 'София',
});

group('diff + message', () => {
  const prev = { lastCheck: '2026-07-26T08:00:00Z', listings: [listing('a', 'Kia', 'Kia Sorento'), listing('b', 'Toyota', 'Toyota RAV4')] };
  const cur = [listing('b', 'Toyota', 'Toyota RAV4'), listing('c', 'Hyundai', 'Hyundai Santa Fe')];

  const d = diffAgainstState(cur, prev);
  check(d.newListings.length === 1 && d.newListings[0].adId === 'c', 'detects the new ad');
  check(d.stillAvailable.length === 1 && d.stillAvailable[0].adId === 'b', 'detects the carried-over ad');
  check(d.goneListings.length === 1 && d.goneListings[0].adId === 'a', 'detects the removed ad');
  check(d.isFirstRun === false, 'not flagged as first run');

  const first = diffAgainstState(cur, { lastCheck: null, listings: [] });
  check(first.isFirstRun === true && first.newListings.length === 2, 'first run treats everything as new');

  check(buildMessage(diffAgainstState(cur, { lastCheck: 'x', listings: cur })) === null, 'silent when nothing changed');
  check(typeof buildMessage(diffAgainstState(cur, { lastCheck: 'x', listings: cur }), { alwaysSend: true }) === 'string', '--always overrides silence');

  const msg = buildMessage(d);
  check(msg.includes('НОВИ обяви (1)'), 'message headlines the new ad');
  check(msg.includes('Свалени/продадени'), 'message reports removals');

  const partialMsg = buildMessage(d, { partial: true });
  check(partialMsg.includes('непълен'), 'partial run is disclosed');
  check(!partialMsg.includes('Свалени/продадени'), 'partial run suppresses removal claims');
});

// ---------------------------------------------------------------- summary
console.log(`\n${'─'.repeat(50)}`);
console.log(`${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
