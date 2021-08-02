const form = document.getElementById('option-form');
const enabledInput = document.getElementById('notifs-enabled');
const offsetInput = document.getElementById('notifs-offset');
const testButton = document.getElementById('test');
const banner = document.getElementById('banner');

(async () => {
	const settings = await getNotificationSettings();
	enabledInput.checked = settings.enabled || false;
	offsetInput.value = settings.offset ?? 3;
})();

form.addEventListener('submit', async (e) => {
	e.preventDefault();

	await setNotificationSettings({
		enabled: enabledInput.checked,
		offset: offsetInput.valueAsNumber ?? null
	});

	chrome.runtime.sendMessage({
		message: "reload-force"
	});

	showBanner('Saved.', '#3ca658');
	return false;
});


async function getNotificationSettings() {
	return new Promise(async (resolve, reject) => {
		chrome.storage.sync.get(['enabled', 'offset'], (data) => {
			return resolve(data);
		});
	});
}

async function setNotificationSettings(settings) {
	const { enabled, offset } = settings;
	return new Promise(async (resolve, reject) => {
		chrome.storage.sync.set({ enabled, offset }, () => {
			return resolve();
		});
	});
}

function showBanner(text, color, textColor = '#ffffff', time = 7 * 1000) {
	banner.innerText = text;
	banner.style.backgroundColor = color;
	banner.style.color = textColor;
	banner.style.display = 'block';
	setTimeout(() => {
		banner.style.display = '';
	}, time);
}