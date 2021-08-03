const scrollElement = document.querySelector('#scroll');
const schedulenameElement = document.querySelector('#schedulename');
let currentSchedule = {};

const periodText = document.querySelector('#period');
const endTimeText = document.querySelector('#end_time');
const nextText = document.querySelector('#next');

let lastData;
// Gets data from /today/now/near
function display(data) {
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
		}
	} else {
		const new_element = document.createElement('div');
		new_element.innerHTML = template.innerHTML;
		put_period_to_element(new_element, null);
		parent.append(new_element);
	}

	update_progress(data);
}

go();

setInterval(() => {
	if (lastData) {
		update_progress(lastData);
	}
}, 1000);


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