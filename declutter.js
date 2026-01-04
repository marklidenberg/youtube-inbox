// ==UserScript==
// @name         youtube-inbox: declutter
// @namespace    http://github.com/marklidenberg/youtube-inbox
// @version      1.0
// @license      MIT
// @description  Declutter YouTube UI by hiding unnecessary elements
// @author       Mark Lidenberg
// @match        http://*.youtube.com/*
// @match        https://*.youtube.com/*
// @noframes
// ==/UserScript==

// Repository: http://github.com/marklidenberg/youtube-inbox

(() => {
	// Bypass YouTube's Trusted Types restrictions
	if (typeof trustedTypes !== 'undefined' && trustedTypes.defaultPolicy === null) {
		trustedTypes.createPolicy('default', { createHTML: (s) => s, createScript: (s) => s, createScriptURL: (s) => s });
	}

	const KEYS = { LOGO: 'DECLUTTER_HIDE_LOGO', CREATE: 'DECLUTTER_HIDE_CREATE', NOTIFICATIONS: 'DECLUTTER_HIDE_NOTIFICATIONS', MICROPHONE: 'DECLUTTER_HIDE_MICROPHONE', SIDEBAR: 'DECLUTTER_HIDE_SIDEBAR', DIVIDERS: 'DECLUTTER_HIDE_DIVIDERS', COMMENTS: 'DECLUTTER_HIDE_COMMENTS', RECOMMENDATIONS: 'DECLUTTER_HIDE_RECOMMENDATIONS', DESCRIPTION_JUNK: 'DECLUTTER_HIDE_DESCRIPTION_JUNK', SHORTS: 'DECLUTTER_HIDE_SHORTS', CHANNEL_JUNK: 'DECLUTTER_HIDE_CHANNEL_JUNK', HOVER_PLAY: 'DECLUTTER_DISABLE_HOVER_PLAY' };
	const INIT_KEY = 'DECLUTTER_INITIALIZED';
	if (!localStorage.getItem(INIT_KEY)) {
		Object.values(KEYS).forEach((k) => localStorage.setItem(k, 'true'));
		localStorage.setItem(INIT_KEY, 'true');
	}
	const get = (k) => localStorage.getItem(k) === 'true';
	const set = (k, v) => localStorage.setItem(k, v);

	// Redirect channel links to /videos - intercept clicks since YouTube resets hrefs
	const isChannelHome = (path) => /^\/@[^/]+$/.test(path) || /^\/@[^/]+\/featured$/.test(path);
	document.addEventListener('click', (e) => {
		const link = e.target.closest('a[href*="/@"]');
		if (!link) return;
		const path = new URL(link.href).pathname;
		if (isChannelHome(path)) {
			e.preventDefault();
			e.stopPropagation();
			window.location.href = path.replace(/\/featured$/, '') + '/videos';
		}
	}, true);

	const style = document.createElement('style');
	style.textContent = `
.DECLUTTER-BTN { background: transparent; border: 1px solid var(--ytd-searchbox-legacy-border-color); border-radius: 40px; margin: 0 20px; padding: 0 16px; height: 40px; color: var(--yt-spec-text-primary); cursor: pointer; font-size: 14px; display: flex; align-items: center; }
.DECLUTTER-BTN:hover { background: var(--yt-spec-badge-chip-background); }
.DECLUTTER-MENU { display: none; position: absolute; top: 100%; right: 0; background: var(--yt-spec-brand-background-primary, #fff); border: 1px solid var(--ytd-searchbox-legacy-border-color); border-radius: 8px; padding: 16px; margin-top: 8px; z-index: 9999; box-shadow: 0 4px 12px rgba(0,0,0,.15); min-width: 200px; }
.DECLUTTER-MENU.open { display: block; }
.DECLUTTER-WRAP { position: relative; display: flex; align-items: center; }
.DECLUTTER-ITEM { display: flex; align-items: center; gap: 8px; padding: 8px 0; color: var(--yt-spec-text-primary); font-size: 14px; cursor: pointer; }
.DECLUTTER-ITEM input { width: 18px; height: 18px; cursor: pointer; }
.DECLUTTER-TOGGLE-ALL { width: 100%; padding: 8px 12px; margin-bottom: 8px; background: var(--yt-spec-badge-chip-background); border: none; border-radius: 4px; color: var(--yt-spec-text-primary); font-size: 14px; cursor: pointer; }
.DECLUTTER-TOGGLE-ALL:hover { background: var(--yt-spec-10-percent-layer); }
.DECLUTTER-HIDE-LOGO ytd-topbar-logo-renderer { display: none !important; }
.DECLUTTER-HIDE-CREATE button[aria-label="Create"] { display: none !important; }
.DECLUTTER-HIDE-NOTIFICATIONS ytd-notification-topbar-button-renderer { display: none !important; }
.DECLUTTER-HIDE-MICROPHONE #voice-search-button { display: none !important; }
.DECLUTTER-HIDE-SIDEBAR ytd-guide-renderer #sections > ytd-guide-section-renderer:has(h3:not([hidden])) { display: none !important; }
.DECLUTTER-HIDE-SIDEBAR ytd-guide-renderer #sections > ytd-guide-collapsible-entry-renderer { display: none !important; }
.DECLUTTER-HIDE-SIDEBAR ytd-guide-renderer #footer { display: none !important; }
.DECLUTTER-HIDE-SIDEBAR ytd-mini-guide-renderer { display: none !important; }
.DECLUTTER-HIDE-SIDEBAR ytd-guide-renderer ytd-guide-entry-renderer:has(a[title="Settings"]) { display: none !important; }
.DECLUTTER-HIDE-SIDEBAR ytd-guide-renderer ytd-guide-entry-renderer:has(a[title="Report history"]) { display: none !important; }
.DECLUTTER-HIDE-SIDEBAR ytd-guide-renderer ytd-guide-entry-renderer:has(a[title="Help"]) { display: none !important; }
.DECLUTTER-HIDE-SIDEBAR ytd-guide-renderer ytd-guide-entry-renderer:has(a[title="Send feedback"]) { display: none !important; }
.DECLUTTER-HIDE-COMMENTS ytd-comments#comments { display: none !important; }
.DECLUTTER-HIDE-RECOMMENDATIONS ytd-watch-next-secondary-results-renderer { display: none !important; }
.DECLUTTER-HIDE-RECOMMENDATIONS ytd-browse[page-subtype="home"] ytd-rich-grid-renderer { display: none !important; }
.DECLUTTER-HIDE-RECOMMENDATIONS ytd-browse[page-subtype="home"] ytd-shelf-renderer { display: none !important; }
.DECLUTTER-HIDE-DESCRIPTION-JUNK #description-inner ytd-text-inline-expander a[href*="/hashtag/"] { display: none !important; }
.DECLUTTER-HIDE-DESCRIPTION-JUNK #description-inner ytd-text-inline-expander .yt-core-attributed-string--highlight-text-decorator { display: none !important; }
.DECLUTTER-HIDE-DESCRIPTION-JUNK #description-inner ytd-text-inline-expander span:has(> a[href*="/hashtag/"]) + span:not(:has(a)) { display: none !important; }
.DECLUTTER-HIDE-DESCRIPTION-JUNK #description-inner ytd-metadata-row-container-renderer { display: none !important; }
.DECLUTTER-HIDE-DESCRIPTION-JUNK #description-inner ytd-video-description-transcript-section-renderer { display: none !important; }
.DECLUTTER-HIDE-DESCRIPTION-JUNK #description-inner ytd-horizontal-card-list-renderer { display: none !important; }
.DECLUTTER-HIDE-DESCRIPTION-JUNK #description-inner ytd-video-description-infocards-section-renderer { display: none !important; }
.DECLUTTER-HIDE-DESCRIPTION-JUNK #description-inner ytd-video-description-music-section-renderer { display: none !important; }
.DECLUTTER-HIDE-SHORTS ytd-rich-section-renderer:has(ytd-rich-shelf-renderer[is-shorts]) { display: none !important; }
.DECLUTTER-HIDE-SHORTS ytd-reel-shelf-renderer { display: none !important; }
.DECLUTTER-HIDE-SHORTS ytd-shorts { display: none !important; }
.DECLUTTER-HIDE-SHORTS a[title="Shorts"] { display: none !important; }
.DECLUTTER-HIDE-SHORTS ytd-mini-guide-entry-renderer:has(a[title="Shorts"]) { display: none !important; }
.DECLUTTER-HIDE-SHORTS ytd-guide-entry-renderer:has(a[title="Shorts"]) { display: none !important; }
.DECLUTTER-HIDE-CHANNEL-JUNK ytd-tabbed-page-header #page-header-container { display: none !important; }
.DECLUTTER-HIDE-CHANNEL-JUNK ytd-c4-tabbed-header-renderer { display: none !important; }
.DECLUTTER-HIDE-CHANNEL-JUNK yt-tab-shape:not([tab-title="Videos"]):not([tab-title="Playlists"]) { display: none !important; }
.DECLUTTER-HIDE-CHANNEL-JUNK tp-yt-paper-tab:not([aria-label="Videos"]):not([aria-label="Playlists"]) { display: none !important; }
.DECLUTTER-HIDE-CHANNEL-JUNK .yt-tab-shape__tab-bar { display: none !important; }
.DECLUTTER-HIDE-CHANNEL-JUNK .tabGroupShapeSlider { display: none !important; }
.DECLUTTER-HIDE-DIVIDERS ytd-guide-section-renderer { border: none !important; }
.DECLUTTER-HIDE-DIVIDERS ytd-guide-collapsible-section-entry-renderer { border: none !important; }
.DECLUTTER-HIDE-DIVIDERS ytd-item-section-renderer { border: none !important; }
.DECLUTTER-HIDE-DIVIDERS ytd-shelf-renderer { border: none !important; }
.DECLUTTER-HIDE-DIVIDERS ytd-rich-section-renderer { border: none !important; }
.DECLUTTER-HIDE-DIVIDERS ytd-horizontal-card-list-renderer { border: none !important; }
.DECLUTTER-HIDE-DIVIDERS #primary-inner > *:not(:last-child) { border-bottom: none !important; }
.DECLUTTER-HIDE-DIVIDERS ytd-watch-metadata { border: none !important; }
.DECLUTTER-HIDE-DIVIDERS #below { border: none !important; }
.DECLUTTER-HIDE-DIVIDERS ytd-merch-shelf-renderer { border: none !important; }
.DECLUTTER-HIDE-DIVIDERS ytd-playlist-panel-renderer { border: none !important; }
.DECLUTTER-HIDE-DIVIDERS #tabs-divider { display: none !important; }
.DECLUTTER-HIDE-DIVIDERS ytd-tabbed-page-header #tabs-inner-container { border: none !important; }
.DECLUTTER-HIDE-DIVIDERS tp-yt-app-header { border: none !important; }
.DECLUTTER-HIDE-DIVIDERS tp-yt-app-toolbar { border: none !important; }
.DECLUTTER-DISABLE-HOVER-PLAY ytd-thumbnail[is-preview-loading] video, .DECLUTTER-DISABLE-HOVER-PLAY ytd-thumbnail[is-preview-loaded] video { display: none !important; }
.DECLUTTER-DISABLE-HOVER-PLAY ytd-thumbnail #mouseover-overlay { display: none !important; }
.DECLUTTER-DISABLE-HOVER-PLAY ytd-thumbnail[is-preview-loading] img, .DECLUTTER-DISABLE-HOVER-PLAY ytd-thumbnail[is-preview-loaded] img { opacity: 1 !important; }
.DECLUTTER-DISABLE-HOVER-PLAY #video-preview { display: none !important; }
.DECLUTTER-DISABLE-HOVER-PLAY ytd-video-preview { display: none !important; }
.DECLUTTER-DISABLE-HOVER-PLAY #preview { display: none !important; }
.DECLUTTER-DISABLE-HOVER-PLAY ytd-thumbnail[is-preview-loaded] { pointer-events: auto !important; }
.DECLUTTER-DISABLE-HOVER-PLAY ytd-thumbnail video { display: none !important; }
.DECLUTTER-DISABLE-HOVER-PLAY ytd-rich-grid-media #mouseover-overlay { display: none !important; }
.DECLUTTER-DISABLE-HOVER-PLAY ytd-rich-item-renderer #mouseover-overlay { display: none !important; }`;
	document.head.appendChild(style);

	const applySettings = () => {
		document.body.classList.toggle('DECLUTTER-HIDE-LOGO', get(KEYS.LOGO));
		document.body.classList.toggle('DECLUTTER-HIDE-CREATE', get(KEYS.CREATE));
		document.body.classList.toggle('DECLUTTER-HIDE-NOTIFICATIONS', get(KEYS.NOTIFICATIONS));
		document.body.classList.toggle('DECLUTTER-HIDE-MICROPHONE', get(KEYS.MICROPHONE));
		document.body.classList.toggle('DECLUTTER-HIDE-SIDEBAR', get(KEYS.SIDEBAR));
		document.body.classList.toggle('DECLUTTER-HIDE-DIVIDERS', get(KEYS.DIVIDERS));
		document.body.classList.toggle('DECLUTTER-HIDE-COMMENTS', get(KEYS.COMMENTS));
		document.body.classList.toggle('DECLUTTER-HIDE-RECOMMENDATIONS', get(KEYS.RECOMMENDATIONS));
		document.body.classList.toggle('DECLUTTER-HIDE-DESCRIPTION-JUNK', get(KEYS.DESCRIPTION_JUNK));
		document.body.classList.toggle('DECLUTTER-HIDE-SHORTS', get(KEYS.SHORTS));
		document.body.classList.toggle('DECLUTTER-HIDE-CHANNEL-JUNK', get(KEYS.CHANNEL_JUNK));
		document.body.classList.toggle('DECLUTTER-DISABLE-HOVER-PLAY', get(KEYS.HOVER_PLAY));
	};
	applySettings();

	const render = () => {
		const target = document.querySelector('#container #end #buttons');
		if (!target || document.querySelector('.DECLUTTER-WRAP')) return;

		const wrap = document.createElement('div');
		wrap.className = 'DECLUTTER-WRAP';
		wrap.innerHTML = `<button class="DECLUTTER-BTN">Declutter</button>
<div class="DECLUTTER-MENU">
<button class="DECLUTTER-TOGGLE-ALL">Toggle All</button>
<label class="DECLUTTER-ITEM"><input type="checkbox" id="dcLogo"${get(KEYS.LOGO) ? ' checked' : ''}>Hide Logo</label>
<label class="DECLUTTER-ITEM"><input type="checkbox" id="dcCreate"${get(KEYS.CREATE) ? ' checked' : ''}>Hide +Create button</label>
<label class="DECLUTTER-ITEM"><input type="checkbox" id="dcNotifications"${get(KEYS.NOTIFICATIONS) ? ' checked' : ''}>Hide Notifications button</label>
<label class="DECLUTTER-ITEM"><input type="checkbox" id="dcMicrophone"${get(KEYS.MICROPHONE) ? ' checked' : ''}>Hide Microphone</label>
<label class="DECLUTTER-ITEM"><input type="checkbox" id="dcSidebar"${get(KEYS.SIDEBAR) ? ' checked' : ''}>Hide Sidebar Junk</label>
<label class="DECLUTTER-ITEM"><input type="checkbox" id="dcDividers"${get(KEYS.DIVIDERS) ? ' checked' : ''}>Hide Dividers</label>
<label class="DECLUTTER-ITEM"><input type="checkbox" id="dcComments"${get(KEYS.COMMENTS) ? ' checked' : ''}>Hide Comments</label>
<label class="DECLUTTER-ITEM"><input type="checkbox" id="dcRecommendations"${get(KEYS.RECOMMENDATIONS) ? ' checked' : ''}>Hide Recommendations</label>
<label class="DECLUTTER-ITEM"><input type="checkbox" id="dcDescriptionJunk"${get(KEYS.DESCRIPTION_JUNK) ? ' checked' : ''}>Hide Description Junk</label>
<label class="DECLUTTER-ITEM"><input type="checkbox" id="dcShorts"${get(KEYS.SHORTS) ? ' checked' : ''}>Hide Shorts</label>
<label class="DECLUTTER-ITEM"><input type="checkbox" id="dcChannelJunk"${get(KEYS.CHANNEL_JUNK) ? ' checked' : ''}>Hide Channel Junk</label>
<label class="DECLUTTER-ITEM"><input type="checkbox" id="dcHoverPlay"${get(KEYS.HOVER_PLAY) ? ' checked' : ''}>Disable Hover-Play</label>
</div>`;

		const menu = wrap.querySelector('.DECLUTTER-MENU');
		const checkboxes = wrap.querySelectorAll('.DECLUTTER-ITEM input[type="checkbox"]');
		wrap.querySelector('.DECLUTTER-BTN').onclick = (e) => { e.stopPropagation(); menu.classList.toggle('open'); };
		wrap.querySelector('.DECLUTTER-TOGGLE-ALL').onclick = (e) => {
			e.stopPropagation();
			const allChecked = [...checkboxes].every((cb) => cb.checked);
			checkboxes.forEach((cb) => { cb.checked = !allChecked; cb.dispatchEvent(new Event('change', { bubbles: true })); });
		};
		wrap.querySelector('#dcLogo').onchange = (e) => { set(KEYS.LOGO, e.target.checked); applySettings(); };
		wrap.querySelector('#dcCreate').onchange = (e) => { set(KEYS.CREATE, e.target.checked); applySettings(); };
		wrap.querySelector('#dcNotifications').onchange = (e) => { set(KEYS.NOTIFICATIONS, e.target.checked); applySettings(); };
		wrap.querySelector('#dcMicrophone').onchange = (e) => { set(KEYS.MICROPHONE, e.target.checked); applySettings(); };
		wrap.querySelector('#dcSidebar').onchange = (e) => { set(KEYS.SIDEBAR, e.target.checked); applySettings(); };
		wrap.querySelector('#dcDividers').onchange = (e) => { set(KEYS.DIVIDERS, e.target.checked); applySettings(); };
		wrap.querySelector('#dcComments').onchange = (e) => { set(KEYS.COMMENTS, e.target.checked); applySettings(); };
		wrap.querySelector('#dcRecommendations').onchange = (e) => { set(KEYS.RECOMMENDATIONS, e.target.checked); applySettings(); };
		wrap.querySelector('#dcDescriptionJunk').onchange = (e) => { set(KEYS.DESCRIPTION_JUNK, e.target.checked); applySettings(); };
		wrap.querySelector('#dcShorts').onchange = (e) => { set(KEYS.SHORTS, e.target.checked); applySettings(); };
		wrap.querySelector('#dcChannelJunk').onchange = (e) => { set(KEYS.CHANNEL_JUNK, e.target.checked); applySettings(); };
		wrap.querySelector('#dcHoverPlay').onchange = (e) => { set(KEYS.HOVER_PLAY, e.target.checked); applySettings(); };
		document.addEventListener('click', (e) => { if (!wrap.contains(e.target)) menu.classList.remove('open'); });

		target.parentNode.insertBefore(wrap, target);
	};

	new MutationObserver(render).observe(document.body, { childList: true, subtree: true });
	render();

})();
