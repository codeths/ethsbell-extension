export async function getSyncData(key) {
	let result = await chrome.storage.sync.get(key);
	return result[key];
}
export async function getLocalData(key) {
	let result = await chrome.storage.local.get(key);
	return result[key];
}

export async function getInstanceDomain() {
	const instance = await getSyncData('instance');
	switch (instance) {
		case 'dayschool':
			return 'https://dayschool.ethsbell.app';
		case 'main':
		default:
			return 'https://ethsbell.app';
	}
}
