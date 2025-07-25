export async function getSyncData(name) {
	console.log(`getSyncData(${name})`);
	let result = await chrome.storage.sync.get();
	return result[name];
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
