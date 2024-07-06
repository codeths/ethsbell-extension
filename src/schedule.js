let all_data;

const calendarElement = document.querySelector('#event-wrapper');
const nowBarElement = document.querySelector('#calendar-today #now');
const preferred_event_min_width = 200;
const min_visible_width = 50;
const min_event_height = 47.5;
const padding = 5;
const pixels_per_minute = 1.5;
let startDate;
let startTime;
let endDate;
let endTime;
let events;
let backgroundColor = 'rgb(255, 255, 255)';
let textColor = 'black';

setInterval(updateNowBar, 1000);

function updateNowBar() {
	const now = current_date().getTime() / 1000;
	if (nowBarElement && startTime && endTime && now >= startTime && now <= endTime) {
		nowBarElement.style.top = `${((now - startTime) / 60 * pixels_per_minute) + 10}px`;
		nowBarElement.style.display = 'block';
	} else {
		nowBarElement.style.display = 'none';
	}
}

updateNowBar();
