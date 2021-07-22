const form = document.getElementById('option-form');
const enabledInput = document.getElementById('notifs-enabled');
const offsetInput = document.getElementById('notifs-offset');
const testButton = document.getElementById('test');

(async () => {
    const settings = await getNotificationSettings();
    enabledInput.checked = settings.enabled || false;
    offsetInput.value = settings.offset ?? 3;
})();

form.addEventListener('submit', async (e) => {
    e.preventDefault();

    await setNotificationSettings({
        enabled: enabledInput.checked,
        offset: offsetInput.valueAsNumber || null
    });

    chrome.extension.sendMessage({
        message: "reload-force"
    });

    alert('Saved.');
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

testButton.addEventListener('click', async (e) => {
    chrome.extension.sendMessage({
        message: "test"
    });
});