// ==UserScript==
// @name         Declutter
// @namespace    https://example.com/
// @version      1.0
// @license      MIT
// @description  A simple userscript with settings
// @match        http://*.youtube.com/*
// @match        https://*.youtube.com/*
// @noframes
// ==/UserScript==

(() => {
	// Storage keys
	const STORAGE_KEY_A = 'DECLUTTER_CHECKBOX_A';
	const STORAGE_KEY_B = 'DECLUTTER_CHECKBOX_B';

	// Load saved state
	const getCheckboxState = (key) => localStorage.getItem(key) === 'true';
	const setCheckboxState = (key, value) => localStorage.setItem(key, value);

	// Add styles
	const addStyle = (css) => {
		const head = document.getElementsByTagName('head')[0];
		if (head) {
			const style = document.createElement('style');
			style.setAttribute('type', 'text/css');
			style.textContent = css;
			head.appendChild(style);
			return style;
		}
		return null;
	};

	addStyle(`
.DECLUTTER-BUTTON {
	background: transparent;
	border: 1px solid var(--ytd-searchbox-legacy-border-color);
	border-radius: 40px;
	margin: 0 20px;
	padding: 0 16px;
	height: 40px;
	color: var(--yt-spec-text-primary);
	cursor: pointer;
	font-size: 14px;
	display: flex;
	align-items: center;
}

.DECLUTTER-BUTTON:hover {
	background: var(--yt-spec-badge-chip-background);
}

.DECLUTTER-MENU {
	display: none;
	position: absolute;
	top: 100%;
	right: 0;
	background: var(--yt-spec-brand-background-primary, #fff);
	border: 1px solid var(--ytd-searchbox-legacy-border-color);
	border-radius: 8px;
	padding: 16px;
	margin-top: 8px;
	z-index: 9999;
	box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
	min-width: 200px;
}

.DECLUTTER-MENU.open {
	display: block;
}

.DECLUTTER-CONTAINER {
	position: relative;
	display: flex;
	align-items: center;
}

.DECLUTTER-CHECKBOX-ITEM {
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 8px 0;
	color: var(--yt-spec-text-primary);
	font-size: 14px;
	cursor: pointer;
}

.DECLUTTER-CHECKBOX-ITEM input {
	width: 18px;
	height: 18px;
	cursor: pointer;
}

.DECLUTTER-CHECKBOX-ITEM label {
	cursor: pointer;
}
`);

	// Find button area target (same as hide-watched-videos.js)
	const findButtonAreaTarget = () => {
		return document.querySelector('#container #end #buttons');
	};

	// Render the settings button and menu
	const renderSettingsButton = () => {
		const target = findButtonAreaTarget();
		if (!target) return;

		// Already rendered?
		if (document.querySelector('.DECLUTTER-CONTAINER')) return;

		// Create container
		const container = document.createElement('div');
		container.classList.add('DECLUTTER-CONTAINER');

		// Create button
		const button = document.createElement('button');
		button.classList.add('DECLUTTER-BUTTON');
		button.textContent = 'SETTINGS';

		// Create menu
		const menu = document.createElement('div');
		menu.classList.add('DECLUTTER-MENU');

		// Checkbox A
		const itemA = document.createElement('div');
		itemA.classList.add('DECLUTTER-CHECKBOX-ITEM');
		const checkboxA = document.createElement('input');
		checkboxA.type = 'checkbox';
		checkboxA.id = 'declutter-checkbox-a';
		checkboxA.checked = getCheckboxState(STORAGE_KEY_A);
		const labelA = document.createElement('label');
		labelA.htmlFor = 'declutter-checkbox-a';
		labelA.textContent = 'Option A';
		itemA.appendChild(checkboxA);
		itemA.appendChild(labelA);

		// Checkbox B
		const itemB = document.createElement('div');
		itemB.classList.add('DECLUTTER-CHECKBOX-ITEM');
		const checkboxB = document.createElement('input');
		checkboxB.type = 'checkbox';
		checkboxB.id = 'declutter-checkbox-b';
		checkboxB.checked = getCheckboxState(STORAGE_KEY_B);
		const labelB = document.createElement('label');
		labelB.htmlFor = 'declutter-checkbox-b';
		labelB.textContent = 'Option B';
		itemB.appendChild(checkboxB);
		itemB.appendChild(labelB);

		menu.appendChild(itemA);
		menu.appendChild(itemB);

		// Event listeners
		button.addEventListener('click', (e) => {
			e.stopPropagation();
			menu.classList.toggle('open');
		});

		checkboxA.addEventListener('change', () => {
			setCheckboxState(STORAGE_KEY_A, checkboxA.checked);
		});

		checkboxB.addEventListener('change', () => {
			setCheckboxState(STORAGE_KEY_B, checkboxB.checked);
		});

		// Close menu when clicking outside
		document.addEventListener('click', (e) => {
			if (!container.contains(e.target)) {
				menu.classList.remove('open');
			}
		});

		container.appendChild(button);
		container.appendChild(menu);
		target.parentNode.insertBefore(container, target);
	};

	// Observe DOM for changes (YouTube uses SPA navigation)
	const observeDOM = () => {
		const MutationObserver = window.MutationObserver || window.WebKitMutationObserver;

		if (MutationObserver) {
			const obs = new MutationObserver(() => {
				renderSettingsButton();
			});

			obs.observe(document.body, { childList: true, subtree: true });
		}
	};

	// Initialize
	observeDOM();
	renderSettingsButton();
})();
