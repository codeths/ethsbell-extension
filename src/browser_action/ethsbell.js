const scrollElement = document.querySelector('#scroll');
const schedulenameElement = document.querySelector('#schedulename');
let currentSchedule = {};

const periodText = document.querySelector('#period');
const endTimeText = document.querySelector('#end_time');
const nextText = document.querySelector('#next');

let lastData;
// Gets data from /today/now/near

let progressIntervals = [];

function display(data) {
	for (const interval of progressIntervals) {
		clearInterval(interval);
	}

	progressIntervals = [];

	lastData = data;

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
		for (const i of data[1]) {
			const new_element = document.createElement('div');
			new_element.innerHTML = template.innerHTML;
			put_period_to_element(new_element, i);

			parent.append(new_element);

			const size = Number.parseFloat(document.defaultView.getComputedStyle(new_element, null).fontSize.slice(0, -2));
			const svg = new_element.querySelector('.progress-ring');
			svg.setAttribute('width', size + 2);
			svg.setAttribute('height', size + 2);
			const circle = new_element.querySelector('.progress-ring__circle');
			circle.setAttribute('cx', size / 2 + 1);
			circle.setAttribute('cy', size / 2 + 1);
			circle.setAttribute('r', size / 4 + 1);
			circle.setAttribute('stroke-width', size / 2 + 2);

			progressIntervals.push(setInterval(() => {
				update_progress_circular(i, new_element);
			}, 1000));
			update_progress_circular(i, new_element);
		}
	} else {
		const new_element = document.createElement('div');
		new_element.innerHTML = template.innerHTML;
		put_period_to_element(new_element, null);
		parent.append(new_element);
	}
}

go();

async function schedule() {
	const day = await get(`/api/v1/today`);
	if (!day) {
		return;
	}

	place_boxes(day.periods);

	schedulenameElement.innerHTML = `${day.friendly_name}<br>`
}

schedule();

chrome.runtime.sendMessage({
	message: "reload"
});

document.getElementById('options').addEventListener('click', (e) => {
	e.preventDefault();
	chrome.runtime.openOptionsPage()
});