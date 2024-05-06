let scrollElement;
let schedulenameElement;
let calenderWrapper;
let periodText;
let endTimeText;
let nextText;
let locationsText;
let loaded = false;
const instanceDomain = getInstanceDomain();
let instance;

const currentSchedule = {};

let lastData;
// Gets data from /today/now/near

let progressIntervals = [];

function display(data) {
	if (!data) {
		return;
	}

	for (const interval of progressIntervals) {
		clearInterval(interval);
	}

	progressIntervals = [];

	if (data[2] && (!data[1] || !data[1][0] || data[1][0].kind !== 'BeforeSchool')) {
		put_period_to_element(getel('next_period'), data[2]);
		getel('next_parent').style.display = 'block';
	} else {
		getel('next_parent').style.display = 'none';
	}

	const template = getel('current_period_time_template');
	const parent = getel('current_parent');
	parent.innerHTML = '';
	if (data[1][0]) {
		if (lastData) {
			const oldPeriods = lastData
				.flat()
				.filter(x => x)
				.map(x => x.friendly_name);
			const nowPeriods = new Set(data[1].filter(x => x).map(x => x.friendly_name));

			if (oldPeriods.every(x => !nowPeriods.has(x))) {
				schedule();
			}
		}

		for (const i of data[1]) {
			const new_element = document.createElement('div');
			new_element.innerHTML = template.innerHTML;
			put_period_to_element(new_element, i);

			parent.append(new_element);

			const size = Number.parseFloat(document.defaultView.getComputedStyle(new_element, null).fontSize.slice(0, -2));
			const svg = new_element.querySelector('.progress-ring');
			if (!svg) {
				return;
			}

			svg.setAttribute('width', size);
			svg.setAttribute('height', size);
			const circle = new_element.querySelector('.progress-ring__circle');
			const border = new_element.querySelector('.progress-ring__border');
			circle.setAttribute('cx', size / 2);
			circle.setAttribute('cy', size / 2);
			circle.setAttribute('r', size / 4 - 1);
			circle.setAttribute('stroke-width', size / 2 - 2);
			border.setAttribute('cx', size / 2);
			border.setAttribute('cy', size / 2);
			border.setAttribute('r', size / 2 - 2);

			progressIntervals.push(
				setInterval(() => {
					update_progress_circular(i, new_element);
				}, 1000),
			);
			update_progress_circular(i, new_element);
		}
	} else {
		const new_element = document.createElement('div');
		new_element.innerHTML = template.innerHTML;
		put_period_to_element(new_element, null);
		parent.append(new_element);
	}

	lastData = data;
}

window.addEventListener('resize', () => display(lastData));

async function schedule() {
	const day = await get(await instanceDomain, '/api/v1/today');
	if (!day) {
		return;
	}

	setColors(bytes_to_color(day.color));
	place_boxes(day);

	if (loaded && day.periods.length > 0) {
		scrollElement.style.display = 'flex';
		calenderWrapper.style.display = 'block';
		schedulenameElement.innerHTML = `${day.friendly_name}`;
		schedulenameElement.style.display = 'inline-block';
	}
}

schedule();

chrome.runtime.sendMessage({
	message: 'reload',
});

let cfg = null;

async function setColors(color) {
	if (!cfg) {
		cfg = await getConfig();
	}

	if (cfg.use_schedule_color !== false) {
		if (color) {
			setStoredColor(color);
		}

		color ??= await getStoredColor();
		if (color) {
			document.body.style.setProperty('--background-color', color);
			document.body.style.setProperty('--text-color', black_or_white(color));
			return;
		}
	}

	document.body.style.setProperty('--background-color', cfg.background_color);
	document.body.style.setProperty('--text-color', cfg.background_text_color);
}

setColors();

async function getStoredColor() {
	return new Promise((resolve, reject) => {
		chrome.storage.local.get('color', data => {
			if (data.color.expires > Date.now()) {
				return resolve(data.color.color);
			}

			return resolve(null);
		});
	});
}

async function setStoredColor(color) {
	return new Promise((resolve, reject) => {
		chrome.storage.local.set({color: {
			color,
			expires: new Date().setHours(24, 0, 0, 0),
		}}, () => resolve());
	});
}

function getLocationString(closed) {
	if (closed.length === 1) {
		return closed[0] + ' is currently closed.';
	}

	const lastLocation = closed.pop();
	return `${closed.join(', ')}${closed.length > 1 ? ',' : ''} and ${lastLocation} are currently closed.`;
}

async function updateLocations() {
	try {
		const req = await fetch(`https://s3.codeths.dev/bell/locations/${instance}`, {cache: 'no-cache'});
		if (!req.ok) {
			throw new Error(`Failed to fetch closed locations: code ${req.status}`);
		}

		const {closed, message} = await req.json();
		locationsText.textContent = "";
		if (closed.length > 0) {
			locationsText.textContent = getLocationString(closed);
			locationsText.style.display = 'block';
		} else if(!message) {
			locationsText.style.display = 'none';
		}
		console.log(message)
		if(message){
			locationsText.textContent += " " + message;
			locationsText.style.display = 'block';
		}
	} catch (error) {
		console.error(error);
	}
}

window.addEventListener('load', async () => {
	scrollElement = document.querySelector('#scroll');
	schedulenameElement = document.querySelector('#schedulename');
	calenderWrapper = document.querySelector('#calendar-wrapper');
	periodText = document.querySelector('#period');
	endTimeText = document.querySelector('#end_time');
	nextText = document.querySelector('#next');
	locationsText = document.querySelector('#locations');
	loaded = true;

	instance = await getInstance();
	updateLocations();
	setInterval(updateLocations, 30000);
	const instanceDomainResolved = await instanceDomain;
	document.querySelector('#homepage-link').href = instanceDomainResolved;
	document.querySelector('#schedule-link').href = `${instanceDomainResolved}/schedule`;

	go(instanceDomainResolved, true);
	schedule();

	document.querySelector('#options').addEventListener('click', e => {
		e.preventDefault();
		chrome.runtime.openOptionsPage();
	});
});
