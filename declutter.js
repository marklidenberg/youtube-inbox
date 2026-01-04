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
	// Bypass YouTube's Trusted Types restrictions
	if (typeof trustedTypes !== 'undefined' && trustedTypes.defaultPolicy === null) {
		trustedTypes.createPolicy('default', { createHTML: (s) => s, createScript: (s) => s, createScriptURL: (s) => s });
	}

	const KEYS = { A: 'DECLUTTER_CHECKBOX_A', B: 'DECLUTTER_CHECKBOX_B' };
	const get = (k) => localStorage.getItem(k) === 'true';
	const set = (k, v) => localStorage.setItem(k, v);

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
.DECLUTTER-TOGGLE-ALL:hover { background: var(--yt-spec-10-percent-layer); }`;
	document.head.appendChild(style);

	const render = () => {
		const target = document.querySelector('#container #end #buttons');
		if (!target || document.querySelector('.DECLUTTER-WRAP')) return;

		const wrap = document.createElement('div');
		wrap.className = 'DECLUTTER-WRAP';
		wrap.innerHTML = `<button class="DECLUTTER-BTN">Declutter</button>
<div class="DECLUTTER-MENU">
<button class="DECLUTTER-TOGGLE-ALL">Toggle All</button>
<label class="DECLUTTER-ITEM"><input type="checkbox" id="dcA"${get(KEYS.A) ? ' checked' : ''}>Option A</label>
<label class="DECLUTTER-ITEM"><input type="checkbox" id="dcB"${get(KEYS.B) ? ' checked' : ''}>Option B</label>
</div>`;

		const menu = wrap.querySelector('.DECLUTTER-MENU');
		const checkboxes = wrap.querySelectorAll('.DECLUTTER-ITEM input[type="checkbox"]');
		wrap.querySelector('.DECLUTTER-BTN').onclick = (e) => { e.stopPropagation(); menu.classList.toggle('open'); };
		wrap.querySelector('.DECLUTTER-TOGGLE-ALL').onclick = (e) => {
			e.stopPropagation();
			const allChecked = [...checkboxes].every((cb) => cb.checked);
			checkboxes.forEach((cb) => { cb.checked = !allChecked; cb.dispatchEvent(new Event('change', { bubbles: true })); });
		};
		wrap.querySelector('#dcA').onchange = (e) => set(KEYS.A, e.target.checked);
		wrap.querySelector('#dcB').onchange = (e) => set(KEYS.B, e.target.checked);
		document.addEventListener('click', (e) => { if (!wrap.contains(e.target)) menu.classList.remove('open'); });

		target.parentNode.insertBefore(wrap, target);
	};

	new MutationObserver(render).observe(document.body, { childList: true, subtree: true });
	render();
})();
