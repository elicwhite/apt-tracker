const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const RESULTS_FILE = path.join(__dirname, 'results', 'data.json');

const INDIGO_URL = 'https://www.indigoapthomes.com';
const INDIGO_JSON =
  'https://www.indigoapthomes.com/en/apartments/residences/_jcr_content.residences.json';

const date = currentTimeInTimezone('America/New_York');
const month = String(date.getMonth() + 1).padStart(2, '0');
const day = String(date.getDate()).padStart(2, '0');
const shortDateString = `20-${month}-${day}`;

async function run() {
  const result = await fetch(INDIGO_JSON);
  let json;
  try {
    json = await result.json();
  } catch (err) {
    console.error(`Unable to fetch page at ${INDIGO_JSON}`);
    throw err;
  }

  const filteredResults = json.map(result => ({
    available: result.available,
    unitName: result.unitName,
    floorPlanName: result.floorPlanName,
    bedrooms: result.bedrooms,
    bathrooms: result.bathrooms,
    sqft: result.sqft,
    minRent: result.minRent,
    maxRent: result.maxRent,
    diagrams: path.join(INDIGO_URL, result.diagrams),
  }));

  const data = require(RESULTS_FILE);
  data[shortDateString] = filteredResults;

  fs.writeFileSync(RESULTS_FILE, JSON.stringify(data));
}

function currentTimeInTimezone(timezone) {
  var date = new Date();

  var invdate = new Date(
    date.toLocaleString('en-US', {
      timeZone: timezone,
    }),
  );

  return invdate;
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
