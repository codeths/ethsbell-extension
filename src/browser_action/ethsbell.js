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

		const {closed} = await req.json();

		if (closed.length > 0) {
			locationsText.textContent = getLocationString(closed);
			locationsText.style.display = 'block';
		} else {
			locationsText.style.display = 'none';
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

async function place_boxes(data_unprocessed, date = current_date(), force = false, today = true) {
	showNowBar = today;

	calendarElement.innerHTML = '';
	if (data_unprocessed && (!events || force)) {
		calendarElement.style.height = 'auto';
		if (!data_unprocessed.periods[0]) {
			updateNowBar();
			return;
		}

		const data = (await replace_period(data_unprocessed.periods.filter(p => p.kind !== 'Passing'))).filter(v => v);
		startDate = date_from_api(data[0].start, date);
		startTime = startDate.getTime() / 1000;
		endDate = date_from_api(data[data.length - 1].end, date);
		endTime = endDate.getTime() / 1000;
		updateNowBar();
		const sInDay = endTime - startTime;
		let containerHeight = sInDay / 60 * pixels_per_minute;
		const lastColHeight = {};

		// Resolve rows so everything is mutually non-intersecting.
		events = [];

		for (const [i, period] of data.sort((a, b) => date_from_api(a.start, date) - date_from_api(b.start, date)).entries()) {
			// Set up variables
			const start = date_from_api(period.start, date).getTime() / 1000;
			const end = date_from_api(period.end, date).getTime() / 1000;
			const duration = end - start;
			let heightChange = 0;

			const startPos = ((start - startTime) / 60) * pixels_per_minute;
			let height = (duration / 60) * pixels_per_minute;
			const endPos = startPos + height;
			if (height < min_event_height) {
				heightChange = (min_event_height - height);
				height = min_event_height;
			}

			let col = 0;

			while (events.filter(event => event.col === col).some(event => startPos < event.endPos || endPos < event.startPos)) {
				col++;
			}

			lastColHeight[col] = heightChange;

			events.push({
				startPos,
				endPos,
				height,
				col,
				period,
			});
		}

		containerHeight += Math.max(...Object.values(lastColHeight));
		calendarElement.style.height = `${containerHeight}px`;
	}

	if (!events) {
		return;
	}

	const indicatorDate = new Date(Math.ceil(startDate.getTime() / 1000 / 60 / 60) * 1000 * 60 * 60);
	while (indicatorDate.getTime() < endDate.getTime()) {
		const time = indicatorDate.toLocaleTimeString('en-US', {timeZone: 'America/Chicago'});
		const formatted = `${time.split(':')[0]} ${time.split(' ')[1]}`;
		const top = ((indicatorDate.getTime() / 1000) - startTime) / 60 * pixels_per_minute;
		const span = document.createElement('span');
		span.classList.add('time');
		span.textContent = formatted;
		span.style.top = `${top}px`;
		calendarElement.append(span);
		indicatorDate.setTime(indicatorDate.getTime() + (60 * 60 * 1000));
	}

	const number_cols = Math.max(...events.map(event => event.col)) + 1;
	const colwidth = calendarElement.clientWidth / number_cols;
	const percent = 1 / number_cols * 100;

	if (data_unprocessed) {
		backgroundColor = data_unprocessed.color ? bytes_to_color(data_unprocessed.color) : '#FFFFFF';
		textColor = black_or_white(backgroundColor);
	}

	for (const event of events) {
		let colspan = 1;

		while (event.col + colspan < number_cols && !events.filter(e => e.col === event.col + colspan).some(e => [event.startPos, event.endPos].some(p => p >= e.startPos && p <= e.endPos))) {
			colspan++;
		}

		let widthOffset = event.col === 0 ? 0 : padding * -2;
		if (colwidth * colspan < preferred_event_min_width && colspan < number_cols) {
			widthOffset = preferred_event_min_width - colwidth * colspan;
			if (widthOffset > colwidth) {
				widthOffset += colwidth - min_visible_width;
			}
		}

		const leftOffset = widthOffset * event.col;

		const element = document.createElement('div');
		element.classList.add('event');

		element.style.top = `${event.startPos - 3}px`;
		element.style.height = `${event.height}px`;

		element.style.left = `calc(${percent * event.col}% ${leftOffset < 0 ? '+' : '-'} ${Math.abs(leftOffset)}px)`;
		element.style.width = `calc(${percent * colspan}% ${widthOffset < 0 ? '-' : '+'} ${Math.abs(widthOffset)}px)`;

		element.style.zIndex = number_cols - event.col + 1;
		element.setAttribute('tabindex', '0');

		element.addEventListener('focus', () => {
			for (const element_ of document.querySelectorAll('#calendar-table .event.selected')) {
				element_.classList.remove('selected');
			}

			element.classList.add('selected');
		});

		const childElement = document.createElement('div');
		childElement.classList.add('event-child');
		childElement.style.backgroundColor = backgroundColor;
		childElement.style.color = textColor;

		const nameElement = document.createElement('span');
		nameElement.classList.add('event-name');
		nameElement.innerHTML = period_html(event.period);
		childElement.append(nameElement);

		const timeElement = document.createElement('span');
		timeElement.classList.add('event-time');
		timeElement.innerHTML = `${human_time(event.period.start)} - ${human_time(event.period.end)} (${human_time_left(event.period.end, event.period.start, true)})`;
		childElement.append(timeElement);

		element.append(childElement);
		calendarElement.append(element);
	}
}

window.addEventListener('resize', () => place_boxes());