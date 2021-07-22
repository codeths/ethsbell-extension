// Set timers for the period end times
async function setTimers() {
    await clearNotificationAlarms();

    const offset = await getNotificationOffset();
    if (offset == null) return;

    const apidata = await get('/api/v1/today');
    if (!apidata) return;

    for (let [i, period] of apidata.periods.entries()) {
        const endtime = (period.end_timestamp - (offset * 60)) * 1000;
        if (endtime > new Date().getTime()) {
            chrome.alarms.create(`Notify_${i}_${period.friendly_name}`, {
                when: endtime
            });
        }
    }
}

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

async function clearAlarm(name) {
    return new Promise(async (resolve, reject) => {
        chrome.alarms.clear(name, () => { return resolve(); })
    });
}

// Manual run
async function runManual() {
    const apidata = await get('/api/v1/today/now');
    if (!apidata) return;
    if (!apidata[0]) return chrome.notifications.create('', {
        type: 'basic',
        iconUrl: '/icons/icon128.png',
        title: 'ETHSBell Notification',
        message: 'There is no period right now.'
    });
    chrome.notifications.create('', {
        type: 'basic',
        iconUrl: '/icons/icon128.png',
        ...getNotificationMessage(apidata[0])
    });
}

// Run notification
async function runNotification(index, name) {
    const apidata = await get('/api/v1/today');
    if (!apidata) return;

    const period = apidata.periods[index];
    if (!period) return;
    if (period.friendly_name !== name) return;

    chrome.notifications.create('', {
        type: 'basic',
        iconUrl: '/icons/icon128.png',
        ...getNotificationMessage(period)
    });
}

function getNotificationMessage(period) {
    const name = period.friendly_name;
    const endTime = new Date(period.end_timestamp * 1000);
    const timeLeft = Math.ceil((endTime.getTime() - Date.now()) / 1000 / 60);
    const endTimeString = endTime.toLocaleTimeString('en-US', { hour: "numeric", minute: "2-digit" });
    return {
        title: `Period ending in ${timeLeft} ${plural_suffix(timeLeft, 'minute')}`,
        message: `${name} ends at ${endTimeString}.`
    };
}

// When alarm goes off

chrome.alarms.onAlarm.addListener(function (alarm) {
    //Refresh data
    if (alarm.name == 'PullData') {
        setTimers();
        setPullDataAlarm();
    }

    //Period notifier
    if (alarm.name.startsWith('Notify')) {
        const split = alarm.name.split('_');
        const index = parseInt(split[1]);
        const name = split.slice(2).join('_');
        runNotification(index, name);
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

chrome.runtime.onStartup.addListener(function () {
    setTimers();
});
chrome.runtime.onInstalled.addListener(function (d) {
    setTimers();
});

chrome.extension.onRequest.addListener((request, sender, sendResponse) => {
    if (request.message == 'reload') {
        setTimers();
    }
    if (request.message == 'test') {
        runManual();
    }
});