const periodText = document.querySelector('#period');
const endTimeText = document.querySelector('#end_time');
const nextText = document.querySelector('#next');
const tableElement = document.querySelector('#table');
const tbodyElement = document.querySelector('#tbody');
const scheduleSelect = document.querySelector('#schedule-select');
const dateSelect = document.querySelector('#date-select');
const calendarTable = document.querySelector('#calendar-table');
const tableTitle = document.querySelector('#tabletitle');
const scrollElement = document.querySelector('#scroll');
const scheduleWrap = document.querySelector('#schedulewrap');
let currentSchedule = {};

// Gets data from /today/now/near
async function display(data) {
    if (data[1]) {
        if (data[1][0].kind == "AfterSchool") {
            periodText.textContent = '';
            endTimeText.textContent = 'School\'s out!';
            nextText.textContent = '';
        } else if (data[1][0].kind == "BeforeSchool") {
            periodText.textContent = '';
            endTimeText.textContent = 'School hasn\'t started yet!';
            nextText.textContent = '';
        } else {
            const names = data[1].map(period => period.friendly_name);
            const ends = data[1].map(period => `${human_time(period.end)} (in ${human_time_left(period.end)})`);
            periodText.textContent = `${human_list(names)} ${data[1].length > 1 ? 'end' : 'ends'} at`;

            endTimeText.textContent = ends.every(value => value === ends[0]) ? `${ends[0]}` : `${human_list(ends)}${data[1].length > 1 ? ', respectively.' : '.'}`;

            nextText.textContent = data[2] ? `The next period is ${data[2].friendly_name}, which ends at ${human_time(data[2].end)}` : 'This is the last period.';
        }
    } else {
        periodText.textContent = 'There is no current period.';
        endTimeText.textContent = '';
        nextText.textContent = '';
    }
    all_data = await get('/api/v1/today').then(v => v.periods);
    place_boxes(all_data);
}

go();

// Build table from period data
function buildTable(data) {
    tbodyElement.innerHTML = '';

    for (const period of data) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${period.friendly_name}</td>
						<td>${human_time(period.start)} - ${human_time(period.end)}</td>
						<td>${human_time_left(period.end, period.start, true)}</td>`;
        tbodyElement.append(tr);
    }
}

// Get today's schedule
async function getToday() {
    const day = await get(`/api/v1/today`);
    if (!day) {
        return;
    }

    currentSchedule = day;

    if (day.periods.length == 0) return;
    buildTable(day.periods);

    scrollElement.style.display = 'flex';
    scheduleWrap.style.display = 'block';

    tableTitle.innerText = `${day.friendly_name} Schedule`
}

getToday();

chrome.extension.sendMessage({
    message: "reload"
});