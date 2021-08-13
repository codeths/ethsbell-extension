const API_BASE = "https://ethsbell.app";
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

	data = await process(data);
	lastFetchedData = data;
	display(data);
}

async function replace_period(period) {
	if (!period) return period;
	if (Array.isArray(period)) {
		return await Promise.all(period.map(replace_period));
	}

	const config = await getSchedule();

	if (period.kind?.Class || period.kind?.ClassOrLunch) {
		const class_id = period.kind.Class || period.kind.ClassOrLunch;
		const class_cfg = config[class_id];
		if (class_cfg) {
			period.friendly_name = class_cfg.name;
			period.url = class_cfg.url;
		}

		return period;
	}

	return period;
}

async function process(data) {
	return await Promise.all(data.map(replace_period));
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
	const date = new Date(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), h, m, s);
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
function date_to_string(date = current_date()) {
	return `${date.getUTCFullYear()}-${('0' + (date.getUTCMonth() + 1)).slice(-2)}-${('0' + date.getUTCDate()).slice(-2)}`;
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

async function getSchedule() {
	return new Promise(async (resolve, reject) => {
		chrome.storage.local.get("schedule", (data) => {
			return resolve(data.schedule || {});
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


// Writes a period to an element and its children
function put_period_to_element(element, period) {
	if (period) {
		if (period.kind === 'BeforeSchool') {
			element.innerHTML = 'School hasn\'t started yet!';
		} else if (period.kind === 'AfterSchool') {
			element.innerHTML = 'School\'s out!';
		} else {
			const start = element.querySelector('.start');
			const start_in = element.querySelector('.start_in');
			const end = element.querySelector('.end');
			const end_in = element.querySelector('.end_in');
			const name = element.querySelector('.name');

			if (start) {
				start.innerText = human_time(period.start);
			}

			if (start_in) {
				start_in.innerText = human_time_left(period.start, undefined, true);
			}

			if (end) {
				end.innerText = human_time(period.end);
			}

			if (end_in) {
				end_in.innerText = human_time_left(period.end, undefined, true);
			}

			if (name) {
				name.innerHTML = period.url ? `<a href="${period.url}">${period.friendly_name}</a>` : period.friendly_name;
			}
		}
	} else {
		element.innerHTML = 'No School';
	}
}


// Convert array of RGB to hex
function bytes_to_color(bytes) {
	return '#' + bytes.map(b => ('0' + b.toString(16)).slice(-2)).join('');
}

// Detect whether text should be black or white based on the background color
function black_or_white(color, opacity = 1) {
	if (!color.startsWith('#')) {
		color = `#${color}`;
	}

	const r = Number.parseInt(color.slice(1, 3), 16);
	const g = Number.parseInt(color.slice(3, 5), 16);
	const b = Number.parseInt(color.slice(5, 7), 16);
	const luma = (0.2126 * r) + (0.7152 * g) + (0.0722 * b);
	return luma > 128 ? `rgba(0, 0, 0, ${opacity})` : `rgba(255, 255, 255, ${opacity})`;
}