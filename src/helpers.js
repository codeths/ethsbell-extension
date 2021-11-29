const API_BASE = 'https://ethsbell.app';
let lastFetchedData = null;

async function get(endpoint = '/api/v1/today/now/near') {
	return fetch(`${API_BASE}${endpoint}?timestamp=${Math.floor(current_date().getTime() / 1000)}`)
		.then(x => x.json().catch(() => null))
		.catch(() => null);
}

function getel(id) {
	return document.querySelector(`#${id}`);
}

async function go(shouldSetTimeout = true) {
	if (lastFetchedData) {
		display(lastFetchedData);
	}

	const now = Date.now();
	const endOfMinute = Math.ceil(now / 60000) * 60000;
	if (shouldSetTimeout) {
		setTimeout(() => go(true), endOfMinute - now);
		setTimeout(() => go(false), 1000);
	}

	let data = await get();
	if (!data) {
		return;
	}

	data = await process(data);
	lastFetchedData = data;
	display(data);
}

async function replace_period(period) {
	if (!period) {
		return period;
	}

	if (Array.isArray(period)) {
		return Promise.all(period.map(x => replace_period(x)));
	}

	const config = await getConfig();
	if (!config) {
		return period;
	}

	const class_id = period.kind.Class || period.kind.ClassOrLunch;
	const class_cfg = config.schedule && (config.schedule[class_id] || config.schedule[period.friendly_name]);
	if (class_cfg) {
		if (class_cfg.name) {
			period.friendly_name = config.include_period_name || config.include_period_name === undefined ? `${period.friendly_name} - ${class_cfg.name}` : class_cfg.name;
		}

		if (class_cfg.url) {
			period.url = class_cfg.url;
		}
	}

	return period;
}

async function process(data) {
	return Promise.all(data.map(x => replace_period(x)));
}

function period_html(period) {
	return period
		? (period.url
			? `<a href=${period.url}>${period.friendly_name.replaceAll('<', '&gt;').replaceAll('>', '&lt;')}</a>`
			: period.friendly_name.replaceAll('<', '&gt;').replaceAll('>', '&lt;'))
		: 'None';
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
	if (typeof window !== 'undefined') {
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
	return date.toLocaleTimeString('en-US', {hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago'});
}

// Gets a human readable duration from an epoch timestamp
function human_time_left(endTime, startTime = null, short = false) {
	const startDate = startTime ? date_from_api(startTime).getTime() : current_date().getTime();
	const endDate = date_from_api(endTime).getTime();
	const timeLeft = Math.floor((endDate - startDate) / 1000);
	const h = Math.floor(timeLeft / 60 / 60);
	const m = Math.ceil((timeLeft / 60) % 60);
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
	return new Promise((resolve, reject) => {
		chrome.storage.sync.get(['enabled', 'offset'], data => {
			if (!data.enabled) {
				return resolve(null);
			}

			return resolve(data.offset ?? null);
		});
	});
}

async function setNotificationOffset(offset) {
	return new Promise((resolve, reject) => {
		chrome.storage.sync.set({offset}, () => resolve());
	});
}

async function setNotificationEnabled(enabled) {
	return new Promise((resolve, reject) => {
		chrome.storage.sync.set({enabled}, () => resolve());
	});
}

async function saveLastKnownData(lastFetchedData) {
	return new Promise((resolve, reject) => {
		chrome.storage.local.set({lastFetchedData}, () => resolve());
	});
}

async function getSchedule() {
	return new Promise((resolve, reject) => {
		chrome.storage.local.get('schedule', data => resolve(data.schedule || {}));
	});
}

async function getConfig() {
	return new Promise((resolve, reject) => {
		chrome.storage.local.get('config', async data => {
			let cfg = data.config;
			if (!cfg) {
				cfg = {
					schedule: await getSchedule() || {},
				};
			}

			return resolve(cfg);
		});
	});
}

async function getTheme() {
	return new Promise((resolve, reject) => {
		chrome.storage.local.get('theme', data => resolve(data.theme || {}));
	});
}

async function didDataChange(newData) {
	return new Promise((resolve, reject) => {
		chrome.storage.local.get(['lastFetchedData'], ({lastFetchedData}) => {
			if (!lastFetchedData) {
				return resolve(true);
			}

			return resolve(!isJSONEqual(lastFetchedData, newData));
		});
	});
}

function isJSONEqual(...objects) {
	const keys = Object.keys(objects[0]);
	// Check if objects have the same keys
	if (objects.some(obj => keys.some(key => !Object.keys(obj).includes(key)) || Object.keys(obj).some(key => !keys.includes(key)))) {
		return false;
	}

	// Check if objects have the same values
	return objects.every(obj =>
		keys.every(
			key => typeof obj[key] === typeof objects[0][key] && (typeof obj[key] === 'object' && obj[key] && objects[0][key] ? isJSONEqual(obj[key], objects[0][key]) : obj[key] === objects[0][key]),
		),
	);
}

// Writes a period to an element and its children
function put_period_to_element(element, period) {
	if (period) {
		if (period.kind === 'BeforeSchool') {
			element.innerHTML = 'School hasn\'t started yet!';
		} else if (period.kind === 'AfterSchool') {
			element.innerHTML = 'School\'s out!';
		} else {
			element.innerHTML = element.innerHTML
				.replaceAll('{START}', human_time(period.start))
				.replaceAll('{END}', human_time(period.end))
				.replaceAll('{START_IN}', human_time_left(period.start, undefined, true))
				.replaceAll('{END_IN}', human_time_left(period.end, undefined, true))
				.replaceAll('{NAME}', period.url ? `<a href="${period.url}">${period.friendly_name}</a>` : period.friendly_name);
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
	const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
	return luma > 128 ? `rgba(0, 0, 0, ${opacity})` : `rgba(255, 255, 255, ${opacity})`;
}
