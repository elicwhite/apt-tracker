const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const https = require('https');

const RESULTS_FILE = path.join(__dirname, 'results', 'data.json');
const FLATTENED_RESULTS_FILE = path.join(
  __dirname,
  'results',
  'flattened_data.json',
);

const INDIGO_URL = 'https://www.indigoapthomes.com';
const INDIGO_JSON =
  'https://www.indigoapthomes.com/en/apartments/residences/_jcr_content.residences.json';

  const httpsAgent = new https.Agent({
    rejectUnauthorized: false,
  });

function convertToDateString(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const shortDateString = `2022-${month}-${day}`;

  return shortDateString;
}

const date = currentTimeInTimezone('America/New_York');
const shortDateString = convertToDateString(date);

async function run() {
  const result = await fetch(INDIGO_JSON, {
    agent: httpsAgent,
  });
  let json;
  try {
    json = await result.json();
  } catch (err) {
    console.error(`Unable to fetch page at ${INDIGO_JSON}`);
    throw err;
  }

  const filteredResults = json
    .map(result => ({
      available: result.available,
      unitName: result.unitName,
      floorPlanName: result.floorPlanName,
      bedrooms: result.bedrooms,
      bathrooms: result.bathrooms,
      sqft: result.sqft,
      minRent: result.minRent,
      maxRent: result.maxRent,
      diagrams: result.diagrams ? path.join(INDIGO_URL, result.diagrams) : '',
    }))
    .sort(sortByApt);

  const data = require(RESULTS_FILE);
  data[shortDateString] = filteredResults;

  fs.writeFileSync(RESULTS_FILE, JSON.stringify(data, null, 2));

  const dates = Object.keys(data);

  const flattenedData = dates
    .map((date, index) => {
      const yesterdayDateString = dates[index - 1];
      const tomorrowDateString = dates[index + 1];

      return data[date]
        .map(result => {
          const newToday =
            yesterdayDateString == null
              ? null
              : !data[yesterdayDateString].some(
                  listing => listing.unitName === result.unitName,
                );

          const todayIsLast =
            tomorrowDateString == null
              ? null
              : !data[tomorrowDateString].some(
                  listing => listing.unitName === result.unitName,
                );

          return {
            fetchDate: date,
            ...result,
            status: newToday
              ? 'first-day'
              : todayIsLast
              ? 'last-day'
              : 'no-change',
          };
        })
        .sort(sortByApt);
    })
    .reduce((acc, result) => acc.concat(result), []);

  fs.writeFileSync(
    FLATTENED_RESULTS_FILE,
    JSON.stringify(flattenedData, null, 2),
  );
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

function sortByApt(apt1, apt2) {
  return parseInt(apt1.unitName, 10) - parseInt(apt2.unitName, 10);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
