const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const RESULTS_FILE = path.join(__dirname, 'results', 'the-dean-data.json');
const FLATTENED_RESULTS_FILE = path.join(
  __dirname,
  'results',
  'the-dean-flattened_data.json',
);

const INDIGO_URL =
  'https://prometheusapartments.com/ca/mountain-view-apartments/the-dean/';
const THEDEAN_JSON =
  'https://sightmap.com/app/api/v1/dzlpoy9jwg4/sightmaps/2697';

function convertToDateString(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const shortDateString = `2021-${month}-${day}`;

  return shortDateString;
}

const date = currentTimeInTimezone('America/New_York');
const shortDateString = convertToDateString(date);

async function run() {
  const result = await fetch(THEDEAN_JSON);
  let json;
  try {
    json = await result.json();
  } catch (err) {
    console.error(`Unable to fetch page at ${THEDEAN_JSON}`);
    throw err;
  }

  const { floor_plans, units } = json.data;

  // console.log(JSON.stringify(json))
  const floorPlans = floor_plans.reduce((acc, value) => {
    acc[value.id] = value;
    return acc;
  }, {});

  const filteredResults = units
    .map(result => {
      const floorPlan = floorPlans[result.floor_plan_id];
      const price = parseInt(
        result.display_price
          .split('')
          .map(n => parseInt(n, 10))
          .filter(n => !isNaN(n))
          .join(''),
        10,
      );

      return {
        available: result.available_on,
        unitName: result.unit_number,
        floorPlanName: floorPlan.name,
        bedrooms: floorPlan.bedroom_count,
        bathrooms: floorPlan.bathroom_count,
        sqft: result.area,
        minRent: price,
        diagrams: floorPlan.image_url,
      };
    })
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
