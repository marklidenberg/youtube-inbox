// ==UserScript==
// @name         YouTube Declutter
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Hide unwanted YouTube UI elements
// @match        https://www.youtube.com/*
// @match        http://*.youtube.com/*
// @match        http://youtube.com/*
// @match        https://*.youtube.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @noframes
// ==/UserScript==

((_undefined) => {
	"use strict";

	// Needed to bypass YouTube's Trusted Types restrictions
	if (
		typeof trustedTypes !== 'undefined' &&
		trustedTypes.defaultPolicy === null
	) {
		const s = (s) => s;
		trustedTypes.createPolicy('default', {
			createHTML: s,
			createScript: s,
			createScriptURL: s,
		});
	}

	const SELECTORS = {
		sidebarFooter: "#footer.ytd-guide-renderer",
		sidebarSettings:
			"#guide-links-primary.ytd-guide-renderer, ytd-guide-section-renderer:has(#endpoint[href='/account'])",
		sidebarMoreFromYoutube:
			"ytd-guide-section-renderer:has([title='YouTube Premium'], [title='YouTube Studio'], [title='YouTube Music'], [title='YouTube Kids'])",
		sidebarExplore:
			"ytd-guide-section-renderer:has([title='Trending'], [title='Music'], [title='Movies'], [title='Gaming'], [title='News'], [title='Sports'], [title='Learning'], [title='Fashion & Beauty'], [title='Podcasts'])",
		sidebarShorts: "ytd-guide-entry-renderer:has([title='Shorts'])",
		sidebarYou:
			"ytd-guide-section-renderer:has([title='You']), ytd-guide-entry-renderer:has([title='You'])",
		youtubeLogo: "ytd-topbar-logo-renderer",
		micIcon: "#voice-search-button",
		searchIcon: "#search-icon-legacy",
		createButton: "ytd-topbar-menu-button-renderer:has([aria-label='Create'])",
		notifications:
			"ytd-topbar-menu-button-renderer:has([aria-label='Notifications'])",
	};

	const OPTIONS = [
		{ id: "sidebarFooter", label: "Sidebar: Footer" },
		{ id: "sidebarSettings", label: "Sidebar: Settings/Help" },
		{ id: "sidebarMoreFromYoutube", label: "Sidebar: More from YouTube" },
		{ id: "sidebarExplore", label: "Sidebar: Explore" },
		{ id: "sidebarShorts", label: "Sidebar: Shorts" },
		{ id: "sidebarYou", label: "Sidebar: You" },
		{ id: "youtubeLogo", label: "YouTube Logo" },
		{ id: "micIcon", label: "Mic Icon" },
		{ id: "searchIcon", label: "Search Icon" },
		{ id: "createButton", label: "Create Button" },
		{ id: "notifications", label: "Notifications" },
	];

	const ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>';

	// Add styles using same pattern as hide-watched-videos.js
	const addStyle = (aCss) => {
		const head = document.getElementsByTagName('head')[0];
		if (head) {
			const style = document.createElement('style');
			style.setAttribute('type', 'text/css');
			style.textContent = aCss;
			head.appendChild(style);
			return style;
		}
		return null;
	};

	addStyle(`
.YT-DECLUTTER-BUTTONS {
	background: transparent;
	border: 1px solid var(--ytd-searchbox-legacy-border-color);
	border-radius: 40px;
	display: flex;
	gap: 5px;
	margin: 0 20px;
	position: relative;
}

.YT-DECLUTTER-BUTTON {
	align-items: center;
	background: transparent;
	border: 0;
	border-radius: 40px;
	color: var(--yt-spec-icon-inactive);
	cursor: pointer;
	display: flex;
	height: 40px;
	justify-content: center;
	outline: 0;
	width: 40px;
}

.YT-DECLUTTER-BUTTON:focus,
.YT-DECLUTTER-BUTTON:hover {
	background: var(--yt-spec-badge-chip-background);
}

.YT-DECLUTTER-PANEL {
	background: var(--yt-spec-menu-background, #212121);
	border-radius: 12px;
	box-shadow: 0 4px 32px rgba(0,0,0,0.4);
	display: none;
	min-width: 220px;
	padding: 16px;
	position: absolute;
	right: 0;
	top: 100%;
	margin-top: 8px;
	z-index: 9999;
}

.YT-DECLUTTER-PANEL-ON {
	display: block;
}

.YT-DECLUTTER-PANEL-TITLE {
	color: var(--yt-spec-text-primary, white);
	font-weight: bold;
	margin-bottom: 12px;
	font-size: 14px;
}

.YT-DECLUTTER-PANEL-LABEL {
	display: flex;
	align-items: center;
	color: var(--yt-spec-text-secondary, #aaa);
	margin-bottom: 8px;
	cursor: pointer;
	font-size: 13px;
}

.YT-DECLUTTER-PANEL-CHECKBOX {
	margin-right: 8px;
	cursor: pointer;
}
`);

	// ===========================================================

	// Load settings
	function getSettings() {
		try {
			return JSON.parse(GM_getValue("declutterSettings", "{}"));
		} catch {
			return {};
		}
	}

	function saveSettings(settings) {
		GM_setValue("declutterSettings", JSON.stringify(settings));
	}

	// ===========================================================

	// Apply hiding
	function applySettings() {
		const settings = getSettings();
		let css = "";

		for (const option of OPTIONS) {
			if (settings[option.id]) {
				css += `${SELECTORS[option.id]} { display: none !important; }\n`;
			}
		}

		let styleEl = document.getElementById("yt-declutter-dynamic-styles");
		if (!styleEl) {
			styleEl = document.createElement("style");
			styleEl.id = "yt-declutter-dynamic-styles";
			document.head.appendChild(styleEl);
		}
		styleEl.textContent = css;
	}

	// ===========================================================

	const findButtonAreaTarget = () => {
		// Button will be injected into the main header menu
		return document.querySelector('#container #end #buttons');
	};

	// ===========================================================

	const renderButtons = () => {
		// Find button area target
		const target = findButtonAreaTarget();
		if (!target) return;

		// Did we already render the buttons?
		const existingButtons = document.querySelector('.YT-DECLUTTER-BUTTONS');
		if (existingButtons) return;

		// Generate buttons area DOM
		const buttonArea = document.createElement('div');
		buttonArea.classList.add('YT-DECLUTTER-BUTTONS');

		// Render button
		const button = document.createElement('button');
		button.title = 'YouTube Declutter Settings';
		button.classList.add('YT-DECLUTTER-BUTTON');
		button.innerHTML = ICON;
		buttonArea.appendChild(button);

		// Create panel
		const panel = document.createElement('div');
		panel.classList.add('YT-DECLUTTER-PANEL');

		const title = document.createElement('div');
		title.classList.add('YT-DECLUTTER-PANEL-TITLE');
		title.textContent = 'Hide Elements';
		panel.appendChild(title);

		const settings = getSettings();

		for (const option of OPTIONS) {
			const label = document.createElement('label');
			label.classList.add('YT-DECLUTTER-PANEL-LABEL');

			const checkbox = document.createElement('input');
			checkbox.type = 'checkbox';
			checkbox.classList.add('YT-DECLUTTER-PANEL-CHECKBOX');
			checkbox.checked = !!settings[option.id];
			checkbox.addEventListener('change', () => {
				const s = getSettings();
				s[option.id] = checkbox.checked;
				saveSettings(s);
				applySettings();
			});

			label.appendChild(checkbox);
			label.appendChild(document.createTextNode(option.label));
			panel.appendChild(label);
		}

		buttonArea.appendChild(panel);

		button.addEventListener('click', (e) => {
			e.stopPropagation();
			panel.classList.toggle('YT-DECLUTTER-PANEL-ON');
		});

		// Close panel when clicking outside
		document.addEventListener('click', (e) => {
			if (!buttonArea.contains(e.target)) {
				panel.classList.remove('YT-DECLUTTER-PANEL-ON');
			}
		});

		// Insert buttons into DOM
		target.parentNode.insertBefore(buttonArea, target);
	};

	// ===========================================================

	const debounce = function (func, wait, immediate) {
		let timeout;
		return (...args) => {
			const later = () => {
				timeout = null;
				if (!immediate) func.apply(this, args);
			};
			const callNow = immediate && !timeout;
			clearTimeout(timeout);
			timeout = setTimeout(later, wait);
			if (callNow) func.apply(this, args);
		};
	};

	const run = debounce(() => {
		applySettings();
		renderButtons();
	}, 250);

	// ===========================================================

	const observeDOM = (() => {
		const MutationObserver =
			window.MutationObserver || window.WebKitMutationObserver;
		const eventListenerSupported = window.addEventListener;

		return (obj, callback) => {
			// Invalid `obj` given
			if (!obj) return;

			if (MutationObserver) {
				const obs = new MutationObserver((mutations, _observer) => {
					// If the mutation is the script's own buttons being injected, ignore the event
					if (
						mutations.length === 1 &&
						mutations[0].addedNodes?.length === 1 &&
						mutations[0].addedNodes[0].classList?.contains('YT-DECLUTTER-BUTTONS')
					) {
						return;
					}

					if (
						mutations[0].addedNodes.length ||
						mutations[0].removedNodes.length
					) {
						callback(mutations);
					}
				});

				obs.observe(obj, { childList: true, subtree: true });
			} else if (eventListenerSupported) {
				obj.addEventListener('DOMNodeInserted', callback, false);
				obj.addEventListener('DOMNodeRemoved', callback, false);
			}
		};
	})();

	// ===========================================================

	// YouTube does navigation via history and also does a bunch
	// of AJAX video loading. In order to ensure we're always up
	// to date, we have to listen for ANY DOM change event, and
	// re-run our script.
	observeDOM(document.body, run);

	run();
})();
