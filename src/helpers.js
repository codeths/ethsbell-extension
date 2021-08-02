const API_BASE = "https://codeths.eths.k12.il.us";
let lastFetchedData = null;

async function get(endpoint = '/api/v1/today/now/near') {
	return fetch(`${API_BASE}${endpoint}${typeof window !== "undefined" ? window.location.search : ''}`)
		.then(x => x.json()
			.catch(() => null))
		.catch(() => null);
}

function getel(id) {
	return document.querySelector(`#${id}`);
}

async function go() {
	if (lastFetchedData) {
		display(lastFetchedData);
	}

	const now = Date.now();
	const endOfMinute = Math.ceil(now / 60_000) * 60_000;
	setTimeout(go, endOfMinute - now);
	let data = await get();
	if (!data) {
		return;
	}

	data = process(data);
	lastFetchedData = data;
	display(data);
}

function replace_period(period) {
	if (!period) return period;
	if (Array.isArray(period)) {
		return period.map(replace_period);
	}

	if (period.kind?.Class || period.kind?.ClassOrLunch) {
		const class_id = period.kind.Class || period.kind.ClassOrLunch;
		/*const class_cfg = config[class_id];
		if (class_cfg) {
			period.friendly_name = class_cfg.name;
			period.url = class_cfg.url;
		}*/

		return period;
	}

	return period;
}

function process(data) {
	// TODO: This will perform class name replacements
	/*if (config) {
		return data.map(replace_period);
	}*/

	return data;
}

function human_list(items) {
	let output = '';
	if (items.length === 1) {
		return items[0].toString();
	}

	for (let i = 0; i < items.length; i++) {
		if (i === items.length - 1) {
			output += `${items.length > 2 ? ', ' : ' '}and ${items[i].toString()}`;
		} else if (i === 0) {
			output += items[i].toString();
		} else {
			output += `, ${items[i].toString()}`;
		}
	}

	return output;
}

// Add plural suffix to a unit
function plural_suffix(number, string) {
	return `${string}${number === 1 ? '' : 's'}`;
}

// Gets current date
// If timestamp query string is provided, that is used instead of current.
function current_date() {
	if (typeof window !== "undefined") {
		const timestampQueryString = new URLSearchParams(window.location.search).get('timestamp');
		if (timestampQueryString) {
			return new Date(Number.parseInt(timestampQueryString, 10) * 1000);
		}
	}

	return new Date();
}

function date_from_api(time, now = current_date()) {
	const [h, m, s] = time.split(':');
	const date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, s);
	return date;
}

function human_time(time) {
	const date = date_from_api(time);
	return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' });
}

// Gets a human readable duration from an epoch timestamp
function human_time_left(endTime, startTime = null, short = false) {
	const startDate = startTime ? date_from_api(startTime).getTime() : current_date().getTime();
	const endDate = date_from_api(endTime).getTime();
	const timeLeft = Math.floor((endDate - startDate) / 1000);
	const h = Math.floor(timeLeft / 60 / 60);
	const m = Math.ceil(timeLeft / 60 % 60);
	if (short) {
		if (h > 0) {
			return `${h}h ${m}m`;
		}

		return `${m}m`;
	}

	if (h > 0) {
		return `${h} ${plural_suffix(h, 'hour')} and ${m} ${plural_suffix(m, 'minute')}`;
	}

	return `${m} ${plural_suffix(m, 'minute')}`;
}

// Convert date object to YYYY-MM-DD
function date_to_string(date) {
	return `${date.getFullYear()}-${('0' + (date.getMonth() + 1)).slice(-2)}-${('0' + date.getDate()).slice(-2)}`;
}

async function getNotificationOffset() {
	return new Promise(async (resolve, reject) => {
		chrome.storage.sync.get(['enabled', 'offset'], (data) => {
			if (!data.enabled) return resolve(null);
			return resolve(data.offset ?? null);
		});
	});
}

async function setNotificationOffset(offset) {
	return new Promise(async (resolve, reject) => {
		chrome.storage.sync.set({ offset }, () => {
			return resolve();
		});
	});
}

async function setNotificationEnabled(enabled) {
	return new Promise(async (resolve, reject) => {
		chrome.storage.sync.set({ enabled }, () => {
			return resolve();
		});
	});
}

async function saveLastKnownData(lastFetchedData) {
	return new Promise(async (resolve, reject) => {
		chrome.storage.local.set({ lastFetchedData }, () => {
			return resolve();
		});
	});
}

async function didDataChange(newData) {
	return new Promise(async (resolve, reject) => {
		chrome.storage.local.get(["lastFetchedData"], ({ lastFetchedData }) => {
			if (!lastFetchedData) return resolve(true);
			return resolve(!isJSONEqual(lastFetchedData, newData));
		});
	});
}

function isJSONEqual(...objects) {
	let keys = Object.keys(objects[0]);
	// Check if objects have the same keys
	if (objects.some(obj => keys.some(key => !Object.keys(obj).includes(key)) || Object.keys(obj).some(key => !keys.includes(key)))) return false;
	// Check if objects have the same values
	return objects.every(obj => keys.every(key => typeof obj[key] === typeof objects[0][key] && (typeof obj[key] == 'object' ? isJSONEqual(obj[key], objects[0][key]) : obj[key] === objects[0][key])));
}