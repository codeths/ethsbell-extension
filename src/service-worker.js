import { getSyncData, getInstanceDomain } from './static/utils.js';

chrome.runtime.onMessageExternal.addListener(async (message, sender) => {
	if (message && message.message === 'schedule' && message.data) {
		try {
			const data = JSON.parse(message.data);
			if (!data) {
				return;
			}
			chrome.storage.local.set({ config: data });
		} catch {}
	}
});

async function getNotificationOffset() {
	let enabled = await getSyncData('enabled');
	let offset = await getSyncData('offset');
	if (!enabled) {
		return null;
	}
	return offset ?? null;
}

// Set timers for the period end times
async function setTimers(force = false) {
	let instance = await getInstanceDomain();
	const offset = await getNotificationOffset();
	if (offset === null) {
		return;
	}
	let apidata = await fetch(`${instance}/api/v1/today`);
	apidata = await apidata.json();
	if (!apidata) {
		return;
	}

	await clearNotificationAlarms();
	let endTimes = apidata.periods;
	endTimes = endTimes
		.map((period) => (period.end_timestamp - offset * 60) * 1000)
		.filter((timestamp, pos, array) => timestamp > Date.now() && array.indexOf(timestamp) === pos);
	console.log(endTimes);
	endTimes.forEach((timestamp) => {
		console.log('creating alarm... ' + timestamp);
		chrome.alarms.create(`Notify-${timestamp}`, {
			when: timestamp,
		});
	});
}

// Clear all notification timers
async function clearNotificationAlarms() {
	await chrome.alarms.getAll(async (alarms) => {
		for (const alarm of alarms) {
			if (alarm.name.startsWith('Notify')) {
				clearAlarm(alarm.name);
			}
		}
		return;
	});
}

// Clear alarm by name (promisified)
async function clearAlarm(name) {
	await chrome.alarms.clear(name);
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
			(x) =>
				(x.end_timestamp + 60) * 1000 >= timestamp &&
				(offset === null || (x.end_timestamp - 60 * offset) * 1000 <= timestamp)
		)
		.sort((a, b) => a.end_timestamp - b.end_timestamp);
}

// Run notification
async function runNotification(timestamp = Date.now()) {
	let instance = await getInstanceDomain();
	let today = await fetch(`${instance}/api/v1/today`);
	today = await today.json();
	if (!today || !today.periods || !today.periods[0]) {
		return;
	}

	const offset = await getNotificationOffset();
	if (offset === null) {
		return;
	}

	const currentPeriods = findApplicablePeriodEnds(today.periods, timestamp, offset);
	if (!currentPeriods || !currentPeriods[0]) {
		return;
	}

	const periods = today.periods.filter((p) => p.end_timestamp === currentPeriods[0].end_timestamp);

	const endTime = currentPeriods.end_timestamp * 1000;
	const now = Date.now();
	const timeLeftInMinutes = (endTime - now) / 1000 / 60 / 60;
	if (timeLeftInMinutes < -1) {
		return;
	}
	console.log('creating...');
	chrome.notifications.create('', {
		type: 'basic',
		iconUrl: '/src/icons/icon128.png',
		...getNotificationMessage(currentPeriods[0], human_list(periods.map((x) => x.friendly_name))),
	});
}

function getNotificationMessage(period, name, now) {
	const endTime = new Date(period.end_timestamp * 1000);
	const timeLeft = Math.ceil((endTime.getTime() - (now || Date.now())) / 1000 / 60);
	const endTimeString = endTime.toLocaleTimeString('en-US', {
		hour: 'numeric',
		minute: '2-digit',
	});
	return {
		title: `Period ending in ${timeLeft} ${plural_suffix(timeLeft, 'minute')}`,
		message: `${name} ends at ${endTimeString}.`,
	};
}

// When alarm goes off

chrome.alarms.onAlarm.addListener((alarm) => {
	console.log(alarm);
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

function plural_suffix(number, string) {
	return `${string}${number === 1 ? '' : 's'}`;
}

chrome.runtime.onStartup.addListener(() => {
	setTimers();
	setPullDataAlarm();
});
chrome.runtime.onInstalled.addListener(() => {
	setTimers();
	setPullDataAlarm();
});

chrome.runtime.onMessage.addListener((message) => {
	if (message.message === 'reload') {
		setTimers();
		setPullDataAlarm();
	}

	if (message.message === 'test') {
		runManual();
	}

	if (message.message === 'reload-force') {
		setTimers(true);
	}
});

setTimers();
setPullDataAlarm();
