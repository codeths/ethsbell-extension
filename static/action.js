let instance = 'main';
let instance_url;
let wrapper;

let pixelPerMin = 1.5;
let textColor;
window.addEventListener('load', (event) => {
	wrapper = document.getElementById('wrapper');
	updateFrame(true);
	window.setInterval(updateFrame, 3000);
});

async function getInstance() {
	return new Promise((resolve) => {
		chrome.storage.sync.get(['instance'], ({ instance }) => resolve(instance || 'main'));
	});
}

async function fetchData() {
	const timestamp = Math.round(Date.now() / 1000);
	instance = await getInstance();
	instance_url = instance == 'main' ? 'https://ethsbell.app' : 'https://dayschool.ethsbell.app';
	let day = await fetch(`${instance_url}/api/v1/today?timestamp=${timestamp}`);
	let now = await fetch(`${instance_url}/api/v1/today/now/near?timestamp=${timestamp}`);
	let schedule = await chrome.storage.local.get(['config']);
	let locations = await fetch(`https://s3.codeths.dev/bell/locations/${instance}`, {
		cache: 'no-cache',
	});
	return {
		day: await day.json(),
		now: await now.json(),
		locations: await locations.json(),
		schedule: schedule.config ? schedule.config.schedule : false,
	};
}

function drawFrame(data) {
	setLinks();
	textColor = black_or_white(rgb(data.day.color));
	document.getElementById('divider').style.backgroundColor = textColor;
	placeBoxes(data.day, data.schedule);
}

async function updateFrame(draw) {
	let data;
	let schedule = await chrome.storage.local.get(['schedule']);
	if (schedule.schedule && schedule.schedule.updated >= Date.now()) {
		data = schedule.schedule.data;
	} else {
		data = await fetchData();
		let updateTime = Date.now() + 120000;
		if (data.now[1][0]) {
			updateTime = Math.min(Date.now() + 120000, data.now[1][0].end_timestamp * 1000);
		}
		chrome.storage.local.set({ schedule: { data: data, updated: updateTime } });
	}
	if (draw) {
		drawFrame(data);
	}
	document.getElementById('friendly_name').innerHTML = data.day.friendly_name;
	currentPeriod(data.now[1], data.schedule);
	nextPeriod(data.now[2], data.schedule);
	wrapper.style.backgroundColor = rgb(data.day.color);
	let height = 200 + data.now[1].length * 75;
	if (data.locations.message != '') {
		height += 75;
	}
	height += data.locations.closed.length === 0 ? 0 : 75;
	document.body.style.height = `${height}px`;
	document.body.style.height = `${height}px`;
	document.body.style.color = textColor;
	updateLocs(data.locations);
}

function rgb(color) {
	const color_list = `${color[0]}, ${color[1]}, ${color[2]}`;
	return `rgb(${color_list})`;
}

function currentPeriod(periods, schedule) {
	let div = document.getElementById('current_period');
	div.innerHTML = '';
	if (periods[0] && periods[0]['friendly_name'] === 'After School') {
		let h3 = document.createElement('p');
		h3.innerHTML = "School's out!";
		h3.classList.add('out');
		let divider = document.getElementById('divider');
		divider.style.display = 'none';
		div.appendChild(h3);
		return;
	} else if (periods[0] && periods[0]['friendly_name'] === 'Before School') {
		let h3 = document.createElement('p');
		h3.innerHTML = "School hasn't started yet.";
		h3.classList.add('out');
		div.appendChild(h3);
		return;
	}
	for (let index = 0; index < periods.length; index++) {
		let period = periods[index];
		let prd_name = '';
		if (period.kind.Class) {
			prd_name = period.kind.Class;
		} else {
			prd_name = period.friendly_name;
		}
		if (schedule && schedule[prd_name]) {
			if (schedule[prd_name].name != null) {
				period.friendly_name += ` - ${schedule[prd_name].name}`;
			}
			if (schedule[prd_name].url != null) {
				period.href = schedule[prd_name].url;
			}
		}

		let element = document.createElement('div');
		element.id = `period-${index}`;
		element.classList.add('period');
		let circle = document.createElement('div');
		circle.id = `period-${index}-progress`;
		circle.classList.add('progress');
		let text = document.createElement('div');
		text.id = `period-${index}-text`;
		text.classList.add('periodName');
		element.appendChild(circle);
		element.appendChild(text);
		div.appendChild(element);
		currentPeriodProgress(period, `period-${index}-progress`);
		currentPeriodText(period, `period-${index}-text`);
	}
}

function nextPeriod(period, schedule) {
	let div = document.getElementById('next_period');
	div.innerHTML = '';

	if (period == null) {
		div.innerHTML = '';
	} else {
		let prd_name;
		if (period.kind.Class) {
			prd_name = period.kind.Class;
		} else {
			prd_name = period.friendly_name;
		}
		if (schedule && schedule[prd_name] && schedule[prd_name].name != null) {
			period.friendly_name += ` - ${schedule[prd_name].name}`;
		}
		div.innerHTML = `The next period is ${period['friendly_name']}, which ends at ${timestampToHuman(period['end_timestamp'])}.`;
	}
}

function currentPeriodProgress(period, id) {
	let timeRemaining = (period['end_timestamp'] - Date.now() / 1000) * 1000;
	let percentElapsed =
		(Date.now() / 1000 - period['start_timestamp']) /
		(period['end_timestamp'] - period['start_timestamp']);
	let bar = new ProgressBar.Circle(`#${id}`, {
		strokeWidth: 50,
		easing: 'linear',
		color: textColor,
		trailColor: textColor == 'black' ? 'lightgray' : 'darkgray',
		trailWidth: 50,
	});
	bar.set(percentElapsed);
	bar.animate(1, { duration: timeRemaining, easing: 'linear' });
}

function currentPeriodText(period, id) {
	if (period.href) {
		document.getElementById(id).innerHTML =
			`<a href="${period.href}" target="_blank">${period['friendly_name']}</a> ends at <b>${timestampToHuman(period['end_timestamp'])}</b> (in <b>${timestampsToLength(Date.now() / 1000, period['end_timestamp'])}</b>).`;
	} else {
		document.getElementById(id).innerHTML =
			`${period['friendly_name']} ends at <b>${timestampToHuman(period['end_timestamp'])}</b> (in <b>${timestampsToLength(Date.now() / 1000, period['end_timestamp'])}</b>).`;
	}
}

function timestampToHuman(timestamp) {
	let time = new Date(timestamp * 1000);
	return time.toLocaleString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true });
}

function timestampsToLength(start, stop) {
	let duration = (stop - start) / 60;
	let hours = Math.floor(duration / 60);
	let minutes = Math.ceil(duration - hours * 60);
	if (hours > 0) {
		return `${hours}h ${minutes}m`;
	}
	return `${minutes}m`;
}

function generateSchedule(periods, schedule) {
	let boxes = [];
	let start_timestamp;
	let end_timestamp;
	periods.forEach((period) => {
		if (!start_timestamp || period.start_timestamp < start_timestamp) {
			start_timestamp = period.start_timestamp;
		}
		if (!end_timestamp || period.end_timestamp > end_timestamp) {
			end_timestamp = period.end_timestamp;
		}
	});
	let height = ((end_timestamp - start_timestamp) / 60) * pixelPerMin;
	let columns = 1;
	periods.forEach((period) => {
		if (period.kind == 'Passing') {
			return;
		}
		let custom_name = '';
		let url = null;
		let prd_name = '';
		if (period.kind.Class) {
			prd_name = period.kind.Class;
		} else {
			prd_name = period.friendly_name;
		}
		if (schedule[prd_name] && schedule[prd_name].name != null) {
			custom_name = ` - ${schedule[prd_name].name}`;
		}
		if (schedule[prd_name] && schedule[prd_name].url != null) {
			url = schedule[prd_name].url;
		}
		let prd = {
			height: ((period.end_timestamp - period.start_timestamp) / 60) * pixelPerMin,
			name: period.friendly_name + custom_name,
			href: url,
			time_string: `${timestampToHuman(period.start_timestamp)} - ${timestampToHuman(period.end_timestamp)} (${timestampsToLength(period.start_timestamp, period.end_timestamp)})`,
			column: 1,
			start_height: ((period.start_timestamp - start_timestamp) / 60) * pixelPerMin,
			expand: true,
		};
		boxes.forEach((box) => {
			if (
				!(
					prd.start_height >= box.height + box.start_height ||
					prd.start_height + prd.height <= box.start_height
				)
			) {
				if (box.column == prd.column) {
					prd.column = prd.column + 1;
				}
				box.expand = false;
				prd.expand = false;
				if (prd.column > columns) {
					columns = prd.column;
				}
			}
		});
		boxes.push(prd);
	});
	return {
		boxes: boxes,
		height: height,
		columns: columns,
		start: start_timestamp,
		end: end_timestamp,
	};
}

function placeBoxes(data, schedule) {
	let periods = data.periods;
	let box_data = generateSchedule(periods, schedule);
	let div = document.getElementById('schedule');
	let color = rgb(data.color);
	div.style.height = `${box_data.height + 70}px`;

	let times = [];
	let time = new Date(box_data.start * 1000);
	let end = new Date(box_data.end * 1000);
	while (time.getTime() < end.getTime()) {
		let initial_time = new Date(time.getTime());
		time.setHours(time.getHours() + Math.ceil(time.getMinutes() / 60));
		time.setMinutes(0, 0, 0);
		times.push({
			time: time.getTime() / 1000,
			offset: (time.getTime() - initial_time.getTime()) / 1000,
		});
		time.setHours(time.getHours() + 1);
	}
	for (let i = 0; i < times.length; i++) {
		let time = document.createElement('p');
		time.innerHTML = timestampToHuman(times[i]['time']);
		time.style.top = `${(60 * i + times[0]['offset'] / 60) * pixelPerMin}px`;
		time.classList.add('schedule-key');
		div.appendChild(time);
	}
	box_data.boxes.forEach((element) => {
		let multiple = 1;
		if (element.expand) {
			multiple = box_data.columns - element['column'] + 1;
		}
		let box = document.createElement('div');
		box.classList.add('schedule-period');
		box.id = element['name'];
		box.style.height = `${element['height']}px`;
		box.style.top = `${element['start_height']}px`;
		box.style.width = `${(1 / box_data.columns) * 575 * multiple + (multiple - 1 * 10)}px`;
		box.style.left = `${60 + ((element['column'] - 1) / box_data.columns) * 575}px`;
		box.style.backgroundColor = color;
		if (element['start_height'] > 0) {
			box.style.marginTop = `3px`;
			box.style.height = `${element['height'] - 3}px`;
		}
		let name = document.createElement('h3');
		let time = document.createElement('p');
		if (element['href']) {
			name.innerHTML = `<a href="${element['href']}" target="_blank">${element['name']}</a>`;
		} else {
			name.innerHTML = element['name'];
		}
		name.classList.add('schedule-period-name');
		time.classList.add('schedule-time');
		if (element['height'] < 45) {
			time.style.display = 'inline';
			name.style.display = 'inline';
		}
		time.innerHTML = element['time_string'];
		box.appendChild(name);
		box.appendChild(time);
		div.appendChild(box);
	});
	if (box_data.boxes.length > 0) {
		let link = document.createElement('a');
		link.id = 'view';
		link.href = `${instance_url}/schedule`;
		link.target = '_blank';
		link.style.top = `${box_data.height + 10}px`;
		let inner = document.createElement('p');
		inner.innerHTML = 'View More Schedules';
		inner.style.margin = '10px';
		link.appendChild(inner);
		div.appendChild(link);
		document.getElementById('info').classList.remove('hide');
		document.getElementById('divider').classList.remove('hide');
		let bar = document.createElement('div');
		bar.classList.add('bar');
		let start = new Date(box_data.start * 1000);
		bar.style.display = 'none';
		div.appendChild(bar);
		let updateBar = window.setInterval(function () {
			if (new Date().getTime() < end.getTime() && new Date().getTime() > start.getTime()) {
				bar.style.top = `${((new Date().getTime() - start.getTime()) / 60000) * pixelPerMin}px`;
				bar.style.display = '';
			} else {
				bar.style.display = 'none';
			}
		}, 500);
	}
}

// Detect whether text should be black or white based on the background color
function black_or_white(rgb, opacity = 1) {
	rgb = rgb.replace('rgb(', '[');
	rgb = rgb.replace(')', ']');
	let colors = JSON.parse(rgb);
	let r = colors[0];
	let g = colors[1];
	let b = colors[2];
	const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
	return luma > 128 ? `black` : `white`;
}

function updateLocs(data) {
	let locs_div = document.getElementById('closed');
	let msg_div = document.getElementById('message');
	msg_div.innerHTML = data.message;
	locs_div.innerHTML = getLocationString(data.closed);
}

function setLinks() {
	let homepage = document.getElementById('homepage-link');
	homepage.href = instance_url;
	document.querySelector('#options').addEventListener('click', function () {
		if (chrome.runtime.openOptionsPage) {
			chrome.runtime.openOptionsPage();
		} else {
			window.open(chrome.runtime.getURL('options.html'));
		}
	});
}

function getLocationString(closed) {
	if (closed.length === 0) {
		return '';
	} else if (closed.length === 1) {
		return closed[0] + ' is currently closed.';
	}

	const lastLocation = closed.pop();
	return `${closed.join(', ')}${closed.length > 1 ? ',' : ''} and ${lastLocation} are currently closed.`;
}
