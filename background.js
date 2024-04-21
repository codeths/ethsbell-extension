import * as util from './src/helpers.js'
let instance = getInstanceDomain();

// define util functions

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

async function get(API_BASE, endpoint = '/api/v1/today/now/near') {
	return fetch(`${API_BASE}${endpoint}?timestamp=${Math.floor(current_date().getTime() / 1000)}`)
		.then(x => x.json().catch(() => null))
		.catch(() => null);
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

async function getInstanceDomain() {
	const instance = await getInstance();
	switch (instance) {
		case 'dayschool':
			return 'https://dayschool.ethsbell.app';
		case 'main':
		default:
			return 'https://ethsbell.app';
	}
}

async function getInstance() {
	return new Promise(resolve => {
		chrome.storage.sync.get(['instance'], ({instance}) => resolve(instance || 'main'));
	});
}

// Set timers for the period end times
async function setTimers(force = false) {
	const offset = await getNotificationOffset();
	if (offset === null) {
		return;
	}

	const apidata = await get(await instance, '/api/v1/today');
	if (!apidata) {
		return;
	}

	if (!force) {
		const didChange = await didDataChange(apidata);
		if (!didChange) {
			return;
		}
	}

	await saveLastKnownData(apidata);

	await clearNotificationAlarms();

	const endTimes = apidata.periods
		.map(period => (period.end_timestamp - offset * 60) * 1000)
		.filter(
			(timestamp, pos, array) =>
				timestamp > Date.now()
				&& array.indexOf(timestamp) === pos,
		);

	endTimes.forEach(timestamp => {
		chrome.alarms.create(`Notify-${timestamp}`, {
			when: timestamp,
		});
	});
}

// Clear all notification timers
async function clearNotificationAlarms() {
	return new Promise((resolve, reject) => {
		chrome.alarms.getAll(async alarms => {
			for (const alarm of alarms) {
				if (alarm.name.startsWith('Notify')) {
					clearAlarm(alarm.name);
				}
			}

			return resolve();
		});
	});
}

// Clear alarm by name (promisified)
async function clearAlarm(name) {
	return new Promise((resolve, reject) => {
		chrome.alarms.clear(name, () => resolve());
	});
}

// Manual run
async function runManual() {
	chrome.notifications.create('', {
		type: 'basic',
		iconUrl: '/icons/icon128.png',
		title: 'ETHSBell Notification',
		message: 'Notifications work!',
	});
}

function findApplicablePeriodEnds(periods, timestamp, offset = null) {
	return periods
		.filter(
			x =>
				(x.end_timestamp + 60) * 1000 >= timestamp
				&& (offset === null
					|| (x.end_timestamp - 60 * offset) * 1000 <= timestamp),
		)
		.sort((a, b) => a.end_timestamp - b.end_timestamp);
}

// Run notification
async function runNotification(timestamp = Date.now(), mockTime = null) {
	const today = await get(await instance, '/api/v1/today');
	if (!today || !today.periods || !today.periods[0]) {
		return;
	}

	const offset = await getNotificationOffset();
	if (offset === null) {
		return;
	}

	const currentPeriods = findApplicablePeriodEnds(
		today.periods,
		timestamp,
		offset,
	);
	if (!currentPeriods || !currentPeriods[0]) {
		return;
	}

	const nowPeriods = findApplicablePeriodEnds(
		today.periods,
		mockTime || Date.now(),
		offset,
	);
	if (!isJSONEqual(nowPeriods, currentPeriods)) {
		return;
	}

	const periods = today.periods.filter(
		p => p.end_timestamp === currentPeriods[0].end_timestamp,
	);

	const endTime = currentPeriods.end_timestamp * 1000;
	const now = Date.now();
	const timeLeftInMinutes = (endTime - now) / 1000 / 60 / 60;
	if (timeLeftInMinutes < -1) {
		return;
	}

	chrome.notifications.create('', {
		type: 'basic',
		iconUrl: '/icons/icon128.png',
		...getNotificationMessage(
			currentPeriods[0],
			human_list(periods.map(x => x.friendly_name)),
			mockTime,
		),
	});
}

function getNotificationMessage(period, name, now) {
	const endTime = new Date(period.end_timestamp * 1000);
	const timeLeft = Math.ceil(
		(endTime.getTime() - (now || Date.now())) / 1000 / 60,
	);
	const endTimeString = endTime.toLocaleTimeString('en-US', {
		hour: 'numeric',
		minute: '2-digit',
	});
	return {
		title: `Period ending in ${timeLeft} ${plural_suffix(
			timeLeft,
			'minute',
		)}`,
		message: `${name} ends at ${endTimeString}.`,
	};
}

// When alarm goes off

chrome.alarms.onAlarm.addListener(alarm => {
	// Refresh data
	if (alarm.name === 'PullData') {
		setTimers();
		setPullDataAlarm();
	}

	// Period notifier
	if (alarm.name.startsWith('Notify-')) {
		runNotification(alarm.scheduledTime);
	}
});

// Set timer for next day
async function setPullDataAlarm() {
	const date = new Date();
	date.setDate(date.getDate() + 1);
	date.setHours(6, Math.floor(Math.random() * 30) + 1, 0, 0);
	chrome.alarms.clear('PullData', () => {
		chrome.alarms.create('PullData', {
			when: date.getTime(),
		});
	});
}

chrome.runtime.onStartup.addListener(() => {
	setTimers();
	setPullDataAlarm();
});
chrome.runtime.onInstalled.addListener(() => {
	setTimers();
	setPullDataAlarm();
});

chrome.runtime.onMessage.addListener(message => {
	if (message.message === 'reload') {
		setTimers();
		setPullDataAlarm();
	}

	if (message.message === 'test') {
		runManual();
	}

	if (message.message === 'reload-force') {
		instance = getInstanceDomain();
		setTimers(true);
	}
});

chrome.runtime.onMessageExternal.addListener(async (message, sender) => {
	if (message && message.message === 'schedule' && message.data) {
		try {
			const data = JSON.parse(message.data);
			if (!data) {
				return;
			}

			const old = await getConfig();
			if (!isJSONEqual(old, data)) {
				chrome.storage.local.set({config: data || {}});
			}
		} catch {}
	}
});

setTimers();
setPullDataAlarm();
