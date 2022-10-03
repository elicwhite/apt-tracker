const path = require('path');
const fs = require('fs');

const data_2022 = require('./results/flattened_data.json');
const data_2021 = require('./flattened_data_2021.json');
const data_2020 = require('./flattened_data_2020.json');

const dates = new Map();
const data = [...data_2020, ...data_2021, ...data_2022];

const TIME_ON_MARKET_FILE = path.join(
	__dirname,
	'results',
	'time-on-market.json',
  );

// Create a map of <unitNumber, first-day/last-day events>
for (i = data.length - 1; i >= 0; i--) {
	const result = data[i];
	if (['last-day', 'first-day'].includes(result.status)) {
		if (dates.get(result.unitName) == null) {
			dates.set(result.unitName, []);
		}

		dates.get(result.unitName).push(result);
	}
}

const connectedRanges = [];

// Create an array of connected range arrays. A connected range is a set of fetch objects for a listing
// that are assumed to be close enough together that the office took down and reposted it, but no
// tenant moved in during that time.
dates.forEach((unitDataArray, unitNumber) => {
	// if (unitNumber != '311') {
	// 	return;
	// }
	let connectedData = [];

	for (i = 0; i < unitDataArray.length; i++) {
		if (connectedData.length == 0) {
			connectedData.push(unitDataArray[i]);
			continue;
		}
		
		const lastItem = connectedData[connectedData.length-1];
		const nextItem = unitDataArray[i];

		const newer = parseDate(lastItem.fetchDate);
		const older = parseDate(nextItem.fetchDate);

		const daysBetween = daysBetweenDates(older, newer)

		if (daysBetween < 60) {
			connectedData.push(nextItem);
			continue;
		}

		connectedRanges.push(connectedData);
		connectedData = [nextItem];
	}

	if (connectedData.length != 0) {
		connectedRanges.push(connectedData);
	}
});

const listingRanges = connectedRanges.map(connectedRange => {
	// if (connectedRange[0].unitName != '521') {
	// 	return null;
	// }
	if (connectedRange[0].status === 'first-day') {
		// skipping these because either we have invalid data (missing a last-day somehow)
		// or because this apartment is still live and hasn't rented yet
		return null;
	}

	const lastEntry = connectedRange[0];
	const firstEntry = connectedRange[connectedRange.length - 1];

	const firstFetchDate = parseDate(firstEntry.fetchDate);
	const lastListedDate = parseDate(lastEntry.fetchDate);

	// I believe the data for these days is broken. Likely due to a broken Github fetch.
	const blockListDates = [
		new Date(2022, 3, 29), // '2022-04-29'
		new Date(2022, 4, 5), // '2022-05-05',
	];

	const containsBadDate = blockListDates.some(blockListDate => {
		if (blockListDate.getFullYear() == firstFetchDate.getFullYear() &&
		blockListDate.getMonth() == firstFetchDate.getMonth() &&
		blockListDate.getDate() == firstFetchDate.getDate()) {
			return true;
		}

		if (blockListDate.getFullYear() == lastListedDate.getFullYear() &&
		blockListDate.getMonth() == lastListedDate.getMonth() &&
		blockListDate.getDate() == lastListedDate.getDate()) {
			return true;
		}

		return false;
	});

	if (containsBadDate) {
		return null;
	}

	const available = firstEntry.available === 'Now' ? firstFetchDate : parseDateAfter(firstFetchDate, firstEntry.available); 

	return {
		firstListed: convertToDateString(firstFetchDate),
		lastListed: convertToDateString(lastListedDate),
		available: convertToDateString(available),

		daysListed: daysBetweenDates(firstFetchDate, lastListedDate),
		daysAvailable: daysBetweenDates(available, lastListedDate),

		unitName: firstEntry.unitName,
		floorPlanName: firstEntry.floorPlanName,
		bedrooms: firstEntry.bedrooms,
		bathrooms: firstEntry.bathrooms,
		sqft: firstEntry.sqft,
		minRent: firstEntry.minRent,
		diagrams: firstEntry.diagrams,
	}
}).filter(Boolean).sort((item1, item2) => {
	return new Date(item2.available) - new Date(item1.available);
});

fs.writeFileSync(
    TIME_ON_MARKET_FILE,
    JSON.stringify(listingRanges, null, 2),
);

function parseDate(str) {
    var ymd = str.split('-');
    return new Date(ymd[0], ymd[1]-1, ymd[2]);
}

function daysBetweenDates(first, second) {
    // Take the difference between the dates and divide by milliseconds per day.
    // Round to nearest whole number to deal with DST.
    return Math.round((second-first)/(1000*60*60*24));
}

function parseDateAfter(date, laterStringName) {
	// date is a real date
	// laterStringName is like 'January 15th'
	// If date parses to be in January 2022, then January 15th is in 2022. If date is Dec 2021, then it still works

	const year = date.getFullYear();
	const dateMonthIndex = date.getMonth()
	const dateDay = date.getDate();

	const parts = laterStringName.split(' ');
	const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
	const monthIndex = months.indexOf(parts[0]);
	const day = parseInt(parts[1], 10);

	if (dateMonthIndex <= monthIndex) {
		return new Date(year, monthIndex, day);
	} else if (dateMonthIndex > monthIndex) {
		return new Date (year+1, monthIndex, day);
	} else {
		throw new Error('Unhandled Date');
	}
}

function convertToDateString(date) {
	const year = String(date.getFullYear());
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
  
	const shortDateString = `${year}-${month}-${day}`;
  
	return shortDateString;
}