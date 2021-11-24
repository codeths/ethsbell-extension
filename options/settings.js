const form = document.querySelector('#option-form');
const enabledInput = document.querySelector('#notifs-enabled');
const offsetInput = document.querySelector('#notifs-offset');
const testButton = document.querySelector('#test');
const banner = document.querySelector('#banner');

(async () => {
	const settings = await getNotificationSettings();
	enabledInput.checked = settings.enabled || false;
	offsetInput.value = settings.offset ?? 3;
})();

form.addEventListener('submit', async e => {
	e.preventDefault();

	await setNotificationSettings({
		enabled: enabledInput.checked,
		offset: offsetInput.valueAsNumber ?? null,
	});

	chrome.runtime.sendMessage({
		message: 'reload-force',
	});

	showBanner('Saved.', '#3ca658');
	return false;
});

async function getNotificationSettings() {
	return new Promise((resolve, reject) => {
		chrome.storage.sync.get(['enabled', 'offset'], data => resolve(data));
	});
}

async function setNotificationSettings(settings) {
	const {enabled, offset} = settings;
	return new Promise((resolve, reject) => {
		chrome.storage.sync.set({enabled, offset}, () => resolve());
	});
}

function showBanner(text, color, textColor = '#ffffff', time = 7 * 1000) {
	banner.textContent = text;
	banner.style.backgroundColor = color;
	banner.style.color = textColor;
	banner.style.display = 'block';
	setTimeout(() => {
		banner.style.display = '';
	}, time);
}
