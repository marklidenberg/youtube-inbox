// ==UserScript==
// @name         YouTube - Pixelate + Grayscale thumbnails (Videos + Shorts)
// @namespace    local
// @version      2.0
// @description  Makes YouTube video + Shorts thumbnails grayscale and very pixelated (handles dynamic loading)
// @match        http://*.youtube.com/*
// @match        http://youtube.com/*
// @match        https://*.youtube.com/*
// @match        https://youtube.com/*
// @noframes
// ==/UserScript==

((_undefined) => {
	// ---- TWEAK THESE ----
	const PIXEL_SCALE = 0.15;      // smaller = chunkier pixels (try 0.04 .. 0.10)
	const JPEG_QUALITY = 0.25;     // lower = more artifacts (0.15 .. 0.40)
	const ONLY_YTIMG = false;      // only pixelate i.ytimg.com thumbs (safer)
	// ---------------------

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

	// Storage keys
	const PIXELATE_STATE_KEY = 'YT_PIXELATE_STATE';
	const GRAYSCALE_STATE_KEY = 'YT_GRAYSCALE_STATE';

	// Get state from localStorage
	const getPixelateState = () => localStorage.getItem(PIXELATE_STATE_KEY) || 'pixelated';
	const getGrayscaleState = () => localStorage.getItem(GRAYSCALE_STATE_KEY) || 'colored';

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
.YT-PIXELATE-BUTTONS {
	background: transparent;
	border: 1px solid var(--ytd-searchbox-legacy-border-color);
	border-radius: 40px;
	display: flex;
	gap: 5px;
	margin: 0 20px;
}

.YT-PIXELATE-BUTTON {
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

.YT-PIXELATE-BUTTON:focus,
.YT-PIXELATE-BUTTON:hover {
	background: var(--yt-spec-badge-chip-background);
}

.YT-PIXELATE-BUTTON-ACTIVE {
	color: var(--yt-spec-icon-active-other);
}

.YT-PIXELATE-BUTTON-DISABLED {
	color: var(--yt-spec-icon-disabled);
}

.YT-GRAYSCALE-ON {
	filter: grayscale(100%) !important;
}
`);

	const ICONS = {
		pixelated: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><rect x="2" y="2" width="4" height="4"/><rect x="10" y="2" width="4" height="4"/><rect x="18" y="2" width="4" height="4"/><rect x="6" y="6" width="4" height="4"/><rect x="14" y="6" width="4" height="4"/><rect x="2" y="10" width="4" height="4"/><rect x="10" y="10" width="4" height="4"/><rect x="18" y="10" width="4" height="4"/><rect x="6" y="14" width="4" height="4"/><rect x="14" y="14" width="4" height="4"/><rect x="2" y="18" width="4" height="4"/><rect x="10" y="18" width="4" height="4"/><rect x="18" y="18" width="4" height="4"/></svg>',
		disabled: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" opacity="0.4"><rect x="2" y="2" width="4" height="4"/><rect x="10" y="2" width="4" height="4"/><rect x="18" y="2" width="4" height="4"/><rect x="6" y="6" width="4" height="4"/><rect x="14" y="6" width="4" height="4"/><rect x="2" y="10" width="4" height="4"/><rect x="10" y="10" width="4" height="4"/><rect x="18" y="10" width="4" height="4"/><rect x="6" y="14" width="4" height="4"/><rect x="14" y="14" width="4" height="4"/><rect x="2" y="18" width="4" height="4"/><rect x="10" y="18" width="4" height="4"/><rect x="18" y="18" width="4" height="4"/><line x1="2" y1="22" x2="22" y2="2" stroke="currentColor" stroke-width="2"/></svg>',
		grayscale: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2 A10 10 0 0 1 12 22 Z" fill="currentColor"/></svg>',
		colored: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="8" cy="10" r="3" fill="#ff6b6b"/><circle cx="16" cy="10" r="3" fill="#4ecdc4"/><circle cx="12" cy="16" r="3" fill="#ffe66d"/></svg>',
	};

	const THUMB_IMG_SELECTOR = [
		'a[href^="/shorts/"] img',
		'a.reel-item-endpoint img',
		'ytm-shorts-lockup-view-model-v2 img',
		'ytm-shorts-lockup-view-model img',
		'yt-thumbnail-view-model img',
		'.ytThumbnailViewModelImage img',
		'ytd-thumbnail img',
		'a#thumbnail img',
		'yt-image-banner-view-model img',
		'.yt-spec-avatar-shape img',
		'img.ytCoreImageHost',
		'img[class*="ytCoreImage"]',
		'img[src*="i.ytimg.com/vi/"]',
	].join(', ');

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

	// ===========================================================

	const findButtonAreaTarget = () => {
		return document.querySelector('#container #end #buttons');
	};

	// ===========================================================

	const updateGrayscaleClass = () => {
		const isGrayscale = getGrayscaleState() === 'grayscale';
		document.querySelectorAll(THUMB_IMG_SELECTOR).forEach((img) => {
			if (isGrayscale) {
				img.classList.add('YT-GRAYSCALE-ON');
			} else {
				img.classList.remove('YT-GRAYSCALE-ON');
			}
		});
	};

	// ===========================================================

	function getBestSrc(img) {
		return img.currentSrc || img.src || '';
	}

	function looksLikeThumb(src) {
		if (!src) return false;
		if (ONLY_YTIMG && !src.includes('i.ytimg.com')) return false;
		return /i\.ytimg\.com\/(vi|vi_|sb)\/|i\.ytimg\.com\/vi\/|\/oar\d*\.jpg|yt3\.googleusercontent\.com\//i.test(src);
	}

	async function pixelateImgElement(img) {
		if (!img || img.dataset.ytPixelated === '1') return;
		if (getPixelateState() !== 'pixelated') return;

		const src = getBestSrc(img);
		if (!looksLikeThumb(src)) return;
		if (!img.complete || !img.naturalWidth || !img.naturalHeight) return;

		img.dataset.ytPixelated = '1';

		const i = new Image();
		i.crossOrigin = 'anonymous';
		i.referrerPolicy = 'no-referrer';

		const loadPromise = new Promise((resolve, reject) => {
			i.onload = resolve;
			i.onerror = reject;
		});

		i.src = src;

		try {
			await loadPromise;

			const w = i.naturalWidth || img.naturalWidth;
			const h = i.naturalHeight || img.naturalHeight;

			const sw = Math.max(8, Math.round(w * PIXEL_SCALE));
			const sh = Math.max(8, Math.round(h * PIXEL_SCALE));

			const small = document.createElement('canvas');
			small.width = sw;
			small.height = sh;
			const sctx = small.getContext('2d', { willReadFrequently: false });
			sctx.imageSmoothingEnabled = true;
			sctx.drawImage(i, 0, 0, sw, sh);

			const out = document.createElement('canvas');
			out.width = w;
			out.height = h;
			const octx = out.getContext('2d', { willReadFrequently: false });
			octx.imageSmoothingEnabled = false;
			octx.drawImage(small, 0, 0, sw, sh, 0, 0, w, h);

			const dataUrl = out.toDataURL('image/jpeg', JPEG_QUALITY);

			if (!img.dataset.ytOrigSrc) img.dataset.ytOrigSrc = src;

			img.src = dataUrl;
			img.removeAttribute('srcset');

			if (getGrayscaleState() === 'grayscale') {
				img.classList.add('YT-GRAYSCALE-ON');
			}
		} catch (e) {
			img.dataset.ytPixelated = '0';
		}
	}

	// ===========================================================

	let queued = new Set();
	let scheduled = false;

	function queueProcess(root = document) {
		const imgs = root.querySelectorAll(THUMB_IMG_SELECTOR);
		for (const img of imgs) queued.add(img);

		if (!scheduled) {
			scheduled = true;
			requestAnimationFrame(async () => {
				scheduled = false;
				const toProcess = Array.from(queued);
				queued.clear();
				for (const img of toProcess) {
					pixelateImgElement(img);
				}
				updateGrayscaleClass();
			});
		}
	}

	// ===========================================================

	const renderButtons = () => {
		const target = findButtonAreaTarget();
		if (!target) return;

		const existingButtons = document.querySelector('.YT-PIXELATE-BUTTONS');

		const buttonArea = document.createElement('div');
		buttonArea.classList.add('YT-PIXELATE-BUTTONS');

		// Button 1: Pixelate toggle
		const pixelateState = getPixelateState();
		const pixelateBtn = document.createElement('button');
		pixelateBtn.classList.add('YT-PIXELATE-BUTTON');
		if (pixelateState !== 'pixelated') {
			pixelateBtn.classList.add('YT-PIXELATE-BUTTON-DISABLED');
		}
		pixelateBtn.innerHTML = pixelateState === 'pixelated' ? ICONS.pixelated : ICONS.disabled;
		pixelateBtn.title = `Pixelation: ${pixelateState}`;
		buttonArea.appendChild(pixelateBtn);

		pixelateBtn.addEventListener('click', () => {
			const newState = pixelateState === 'pixelated' ? 'disabled' : 'pixelated';
			localStorage.setItem(PIXELATE_STATE_KEY, newState);
			window.location.reload();
		});

		// Button 2: Grayscale toggle
		const grayscaleState = getGrayscaleState();
		const grayscaleBtn = document.createElement('button');
		grayscaleBtn.classList.add('YT-PIXELATE-BUTTON');
		if (grayscaleState !== 'grayscale') {
			grayscaleBtn.classList.add('YT-PIXELATE-BUTTON-DISABLED');
		}
		grayscaleBtn.innerHTML = grayscaleState === 'grayscale' ? ICONS.grayscale : ICONS.colored;
		grayscaleBtn.title = `Color: ${grayscaleState}`;
		buttonArea.appendChild(grayscaleBtn);

		grayscaleBtn.addEventListener('click', () => {
			const newState = grayscaleState === 'grayscale' ? 'colored' : 'grayscale';
			localStorage.setItem(GRAYSCALE_STATE_KEY, newState);
			updateGrayscaleClass();
			renderButtons();
		});

		// Insert buttons into DOM
		if (existingButtons) {
			target.parentNode.replaceChild(buttonArea, existingButtons);
		} else {
			target.parentNode.insertBefore(buttonArea, target);
		}
	};

	// ===========================================================

	const run = debounce(() => {
		queueProcess(document);
		renderButtons();
	}, 250);

	// ===========================================================

	const observeDOM = (() => {
		const MutationObserver =
			window.MutationObserver || window.WebKitMutationObserver;
		const eventListenerSupported = window.addEventListener;

		return (obj, callback) => {
			if (!obj) return;

			if (MutationObserver) {
				const obs = new MutationObserver((mutations, _observer) => {
					if (
						mutations.length === 1 &&
						mutations[0].addedNodes?.length === 1 &&
						mutations[0].addedNodes[0].classList?.contains('YT-PIXELATE-BUTTONS')
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

	observeDOM(document.body, run);

	run();
})();
