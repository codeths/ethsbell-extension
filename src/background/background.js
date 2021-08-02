// Set timers for the period end times
async function setTimers(force = false) {

	const offset = await getNotificationOffset();
	if (offset == null) return;

	const apidata = await get('/api/v1/today');
	if (!apidata) return;

	if (!force) {
		const didChange = await didDataChange(apidata);
		if (!didChange) return;
	}
	await saveLastKnownData(apidata);

	await clearNotificationAlarms();

	const endTimes = apidata.periods.map(period => (period.end_timestamp - (offset * 60)) * 1000).filter((timestamp, pos, array) => timestamp > new Date().getTime() && array.indexOf(timestamp) == pos);

	endTimes.forEach((timestamp) => {
		chrome.alarms.create(`Notify-${timestamp}`, {
			when: timestamp
		});
	});
}

// Clear all notification timers
async function clearNotificationAlarms() {
	return new Promise(async (resolve, reject) => {
		chrome.alarms.getAll(async (alarms) => {
			for (let alarm of alarms) {
				if (alarm.name.startsWith('Notify')) {
					await clearAlarm(alarm.name);
				}
			}
			return resolve();
		});
	});
}

// Clear alarm by name (promisified)
async function clearAlarm(name) {
	return new Promise(async (resolve, reject) => {
		chrome.alarms.clear(name, () => { return resolve(); })
	});
}

// Manual run
async function runManual() {
	chrome.notifications.create('', {
		type: 'basic',
		iconUrl: '/icons/icon128.png',
		title: 'ETHSBell Notification',
		message: 'Notifications work!'
	});
}

function findApplicablePeriodEnds(periods, timestamp, offset = null) {
	return periods.filter(x => (x.end_timestamp + 60) * 1000 >= timestamp && (offset == null || (x.end_timestamp - (60 * offset)) * 1000 <= timestamp)).sort((a, b) => a.end_timestamp - b.end_timestamp);
}

// Run notification
async function runNotification(timestamp = new Date().getTime(), mockTime) {
	const today = await get(`/api/v1/today${mockTime ? `?timestamp=${Math.floor(mockTime / 1000)}` : ''}`);
	if (!today || !today.periods || !today.periods[0]) return;

	const offset = await getNotificationOffset();
	if (offset == null) return;

	const currentPeriods = findApplicablePeriodEnds(today.periods, timestamp, offset);
	if (!currentPeriods || !currentPeriods[0]) return;

	const nowPeriods = findApplicablePeriodEnds(today.periods, mockTime || new Date().getTime(), offset);
	if (JSON.stringify(nowPeriods) !== JSON.stringify(currentPeriods)) return;

	const periods = today.periods.filter(p => p.end_timestamp == currentPeriods[0].end_timestamp);

	const endTime = currentPeriods.end_timestamp * 1000;
	const now = Date.now();
	const timeLeftInMinutes = (endTime - now) / 1000 / 60 / 60;
	if (timeLeftInMinutes < -1) return;

	chrome.notifications.create('', {
		type: 'basic',
		iconUrl: '/icons/icon128.png',
		...getNotificationMessage(currentPeriods[0], human_list(periods.map(x => x.friendly_name)), mockTime)
	});
}

function getNotificationMessage(period, name, now) {
	const endTime = new Date(period.end_timestamp * 1000);
	const timeLeft = Math.ceil((endTime.getTime() - (now || Date.now())) / 1000 / 60);
	const endTimeString = endTime.toLocaleTimeString('en-US', { hour: "numeric", minute: "2-digit" });
	return {
		title: `Period ending in ${timeLeft} ${plural_suffix(timeLeft, 'minute')}`,
		message: `${name} ends at ${endTimeString}.`
	};
}

// When alarm goes off

chrome.alarms.onAlarm.addListener((alarm) => {
	//Refresh data
	if (alarm.name == 'PullData') {
		setTimers();
		setPullDataAlarm();
	}

	//Period notifier
	if (alarm.name.startsWith('Notify-')) {
		runNotification(alarm.scheduledTime);
	}
});

// Set timer for next day
async function setPullDataAlarm() {
	let date = new Date();
	date.setDate(date.getDate() + 1);
	date.setHours(6, Math.floor(Math.random() * 30) + 1, 0, 0);
	await chrome.alarms.clear('PullData').catch(e => null);
	chrome.alarms.create('PullData', {
		when: date.getTime()
	});
}

chrome.runtime.onStartup.addListener(() => {
	setTimers();
});
chrome.runtime.onInstalled.addListener(() => {
	setTimers();
});

chrome.extension.onMessage.addListener((message) => {
	if (message.message == 'reload') {
		setTimers();
	}
	if (message.message == 'test') {
		runManual();
	}
	if (message.message == 'reload-force') {
		setTimers(true);
	}
});