// ==UserScript==
// @name         YouTube: Hide Watched Videos
// @namespace    http://github.com/marklidenberg/youtube-inbox
// @version      1.0
// @license      MIT
// @description  Hides watched videos from your YouTube subscriptions page.
// @author       Mark Lidenberg
// @match        http://*.youtube.com/*
// @match        http://youtube.com/*
// @match        https://*.youtube.com/*
// @match        https://youtube.com/*
// @noframes
// ==/UserScript==

// Repository: http://github.com/marklidenberg/youtube-inbox

const REGEX_CHANNEL = /.*\/(user|channel|c)\/.+\/videos/u;
const REGEX_USER = /.*\/@.*/u;
const FULLY_WATCHED_THRESHOLD = 100;

((_undefined) => {
	// Enable for debugging
	const DEBUG = false;

	// Needed to bypass YouTube's Trusted Types restrictions, ie.
	// Uncaught TypeError: Failed to set the 'innerHTML' property on 'Element': This document requires 'TrustedHTML' assignment.
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

	const HIDDEN_THRESHOLD_PERCENT = 10;

	const logDebug = (...msgs) => {
		if (DEBUG) console.debug('[YT-HWV]', msgs);
	};

	// GreaseMonkey no longer supports GM_addStyle. So we have to define
	// our own polyfill here
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

	// Get current section for immediate CSS application
	const getCurrentSection = () => {
		const { href } = window.location;
		if (href.includes('/watch?')) return 'watch';
		if (href.match(REGEX_CHANNEL) || href.match(REGEX_USER)) return 'channel';
		if (href.includes('/feed/subscriptions')) return 'subscriptions';
		if (href.includes('/feed/trending')) return 'trending';
		if (href.includes('/playlist?')) return 'playlist';
		if (href.includes('/results?')) return 'search';
		return 'misc';
	};

	// Apply immediate hiding CSS based on localStorage state
	const applyImmediateHidingCSS = () => {
		const section = getCurrentSection();
		const state = localStorage.getItem(`YTHWV_STATE_${section}`);

		// Remove any existing immediate-hide style
		const existingStyle = document.getElementById('YT-HWV-IMMEDIATE-HIDE');
		if (existingStyle) existingStyle.remove();

		if (!state || state === 'normal' || window.location.href.includes('/feed/history')) {
			return;
		}

		// CSS selectors for progress bars that indicate watched videos
		const progressBarSelectors = [
			'.ytd-thumbnail-overlay-resume-playback-renderer',
			'.ytThumbnailOverlayProgressBarHostWatchedProgressBarSegment',
			'.ytThumbnailOverlayProgressBarHostWatchedProgressBarSegmentModern',
		].join(',');

		// Container selectors based on section
		let containerSelectors;
		if (section === 'subscriptions') {
			containerSelectors = [
				'ytd-rich-item-renderer',
				'ytd-grid-video-renderer',
				'ytd-video-renderer',
			];
		} else if (section === 'playlist') {
			containerSelectors = ['ytd-playlist-video-renderer'];
		} else if (section === 'watch') {
			containerSelectors = ['ytd-compact-video-renderer', 'yt-lockup-view-model'];
		} else {
			containerSelectors = [
				'ytd-rich-item-renderer',
				'ytd-video-renderer',
				'ytd-grid-video-renderer',
			];
		}

		let css = '';

		if (state === 'hidden' || state === 'fullyWatched') {
			// Hide containers that have a progress bar
			containerSelectors.forEach(container => {
				css += `${container}:has(${progressBarSelectors}) { display: none !important; }\n`;
			});
		} else if (state === 'dimmed') {
			// Dim containers that have a progress bar
			containerSelectors.forEach(container => {
				css += `${container}:has(${progressBarSelectors}) { opacity: 0.3; }\n`;
			});
		}

		if (css) {
			const style = document.createElement('style');
			style.id = 'YT-HWV-IMMEDIATE-HIDE';
			style.textContent = css;
			document.head.appendChild(style);
		}
	};

	// Apply immediately
	applyImmediateHidingCSS();

	addStyle(`
.YT-HWV-WATCHED-HIDDEN { display: none !important }

.YT-HWV-WATCHED-DIMMED { opacity: 0.3 }

.YT-HWV-FULLY-WATCHED-HIDDEN { display: none !important }

.YT-HWV-HIDDEN-ROW-PARENT { padding-bottom: 10px }

.YT-HWV-BUTTONS {
	background: transparent;
	border: 1px solid var(--ytd-searchbox-legacy-border-color);
    border-radius: 40px;
    display: flex;
    gap: 5px;
	margin: 0 20px;
}

.YT-HWV-BUTTON {
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

.YT-HWV-BUTTON:focus,
.YT-HWV-BUTTON:hover {
	background: var(--yt-spec-badge-chip-background);
}

.YT-HWV-BUTTON-DISABLED { color: var(--yt-spec-icon-disabled) }

.YT-HWV-MENU {
	background: #F8F8F8;
	border: 1px solid #D3D3D3;
	box-shadow: 0 1px 0 rgba(0, 0, 0, 0.05);
	display: none;
	font-size: 12px;
	margin-top: -1px;
	padding: 10px;
	position: absolute;
	right: 0;
	text-align: center;
	top: 100%;
	white-space: normal;
	z-index: 9999;
}

.YT-HWV-MENU-ON { display: block; }
.YT-HWV-MENUBUTTON-ON span { transform: rotate(180deg) }

/* Hide Watch Later and Add to Queue buttons on hover */
ytd-thumbnail-overlay-toggle-button-renderer[aria-label="Watch later"],
ytd-thumbnail-overlay-toggle-button-renderer[aria-label="Add to queue"],
ytd-thumbnail button[aria-label="Watch later"],
ytd-thumbnail button[aria-label="Add to queue"],
#hover-overlays ytd-thumbnail-overlay-toggle-button-renderer { display: none !important; }

/* Thumbnail action buttons */
.YT-HWV-THUMB-ACTIONS {
	position: absolute;
	bottom: 4px;
	right: 4px;
	display: flex;
	gap: 2px;
	z-index: 100;
	opacity: 0;
	transition: opacity 0.2s;
}

ytd-thumbnail:hover .YT-HWV-THUMB-ACTIONS,
.YT-HWV-THUMB-ACTIONS:hover { opacity: 1; }

.YT-HWV-THUMB-BTN {
	width: 28px;
	height: 28px;
	border: none;
	border-radius: 4px;
	background: rgba(0, 0, 0, 0.7);
	color: white;
	cursor: pointer;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 0;
}

.YT-HWV-THUMB-BTN:hover { background: rgba(0, 0, 0, 0.9); }
.YT-HWV-THUMB-BTN.active { color: #3ea6ff; }
.YT-HWV-THUMB-BTN.liked { color: #3ea6ff; }
.YT-HWV-THUMB-BTN.disliked { color: #f44336; }

/* Video page watched button - inside like/dislike segmented button */
.YT-HWV-SEGMENTED-MODIFIED { display: flex !important; align-items: center; }

.YT-HWV-VIDEO-WATCHED-BTN {
	display: flex !important;
	align-items: center;
	justify-content: center;
	width: 52px;
	height: 36px;
	border: none;
	border-left: 1px solid rgba(0,0,0,0.1);
	border-radius: 0 18px 18px 0;
	background: var(--yt-spec-badge-chip-background, #f2f2f2);
	color: var(--yt-spec-text-primary, #0f0f0f);
	cursor: pointer;
	margin: 0;
	padding: 0;
}

.YT-HWV-VIDEO-WATCHED-BTN:hover { background: var(--yt-spec-button-chip-background-hover, #e5e5e5); }
.YT-HWV-VIDEO-WATCHED-BTN.active { color: #3ea6ff; }

/* Fix dislike button border radius when watched button is added */
.YT-HWV-SEGMENTED-MODIFIED dislike-button-view-model button,
.YT-HWV-SEGMENTED-MODIFIED #segmented-dislike-button button,
.YT-HWV-SEGMENTED-MODIFIED yt-button-shape button { border-radius: 0 !important; }
.YT-HWV-SEGMENTED-MODIFIED dislike-button-view-model yt-button-shape button { border-radius: 0 !important; }

/* Force search bar to always be centered */
ytd-masthead #center {
	position: absolute !important;
	left: 50% !important;
	transform: translateX(-50%) !important;
	width: 40% !important;
	min-width: 480px !important;
	max-width: 732px !important;
}
ytd-masthead #container.ytd-masthead {
	position: relative !important;
}
`);

	const BUTTON = {
		icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 48 48"><path fill="currentColor" d="M24 9C14 9 5.46 15.22 2 24c3.46 8.78 12 15 22 15 10.01 0 18.54-6.22 22-15-3.46-8.78-11.99-15-22-15zm0 25c-5.52 0-10-4.48-10-10s4.48-10 10-10 10 4.48 10 10-4.48 10-10 10zm0-16c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6z"/></svg>',
		iconDimmed:
			'<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 48 48"><path fill="currentColor" opacity="0.5" d="M24 9C14 9 5.46 15.22 2 24c3.46 8.78 12 15 22 15 10.01 0 18.54-6.22 22-15-3.46-8.78-11.99-15-22-15zm0 25c-5.52 0-10-4.48-10-10s4.48-10 10-10 10 4.48 10 10-4.48 10-10 10zm0-16c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6z"/></svg>',
		iconHidden:
			'<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 48 48"><path fill="currentColor" d="M24 14c5.52 0 10 4.48 10 10 0 1.29-.26 2.52-.71 3.65l5.85 5.85c3.02-2.52 5.4-5.78 6.87-9.5-3.47-8.78-12-15-22.01-15-2.8 0-5.48.5-7.97 1.4l4.32 4.31c1.13-.44 2.36-.71 3.65-.71zM4 8.55l4.56 4.56.91.91C6.17 16.6 3.56 20.03 2 24c3.46 8.78 12 15 22 15 3.1 0 6.06-.6 8.77-1.69l.85.85L39.45 44 42 41.46 6.55 6 4 8.55zM15.06 19.6l3.09 3.09c-.09.43-.15.86-.15 1.31 0 3.31 2.69 6 6 6 .45 0 .88-.06 1.3-.15l3.09 3.09C27.06 33.6 25.58 34 24 34c-5.52 0-10-4.48-10-10 0-1.58.4-3.06 1.06-4.4zm8.61-1.57 6.3 6.3L30 24c0-3.31-2.69-6-6-6l-.33.03z"/></svg>',
		iconFullyWatched:
			'<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><text x="12" y="16" text-anchor="middle" font-size="12" font-weight="bold" fill="currentColor">100</text><line x1="2" y1="20" x2="22" y2="4" stroke="currentColor" stroke-width="2"/></svg>',
		name: 'Toggle Watched Videos',
		stateKey: 'YTHWV_STATE',
	};

	const ICONS = {
		like: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z"/></svg>',
		dislike: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M15 3H6c-.83 0-1.54.5-1.84 1.22l-3.02 7.05c-.09.23-.14.47-.14.73v2c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L9.83 23l6.59-6.59c.36-.36.58-.86.58-1.41V5c0-1.1-.9-2-2-2zm4 0v12h4V3h-4z"/></svg>',
		watched: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>',
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

	// ===========================================================

	const findWatchedElements = () => {
		const watched = document.querySelectorAll(
			[
				'.ytd-thumbnail-overlay-resume-playback-renderer',
				// Recommended videos on the right-hand sidebar when watching a video
				'.ytThumbnailOverlayProgressBarHostWatchedProgressBarSegment',
				// 2025-02-01 Update
				'.ytThumbnailOverlayProgressBarHostWatchedProgressBarSegmentModern',
			].join(','),
		);

		const withThreshold = Array.from(watched).filter((bar) => {
			return (
				bar.style.width &&
				Number.parseInt(bar.style.width, 10) >= HIDDEN_THRESHOLD_PERCENT
			);
		});

		logDebug(
			`Found ${watched.length} watched elements ` +
				`(${withThreshold.length} within threshold)`,
		);

		return withThreshold;
	};

	const findFullyWatchedElements = () => {
		const watched = document.querySelectorAll(
			[
				'.ytd-thumbnail-overlay-resume-playback-renderer',
				'.ytThumbnailOverlayProgressBarHostWatchedProgressBarSegment',
				'.ytThumbnailOverlayProgressBarHostWatchedProgressBarSegmentModern',
			].join(','),
		);

		const fullyWatched = Array.from(watched).filter((bar) => {
			return (
				bar.style.width &&
				Number.parseInt(bar.style.width, 10) >= FULLY_WATCHED_THRESHOLD
			);
		});

		logDebug(`Found ${fullyWatched.length} fully watched elements (>=${FULLY_WATCHED_THRESHOLD}%)`);

		return fullyWatched;
	};

	// ===========================================================

	const findButtonAreaTarget = () => {
		// Button will be injected into the main header menu
		return document.querySelector('#container #end #buttons');
	};

	// ===========================================================

	const determineYoutubeSection = () => {
		const { href } = window.location;

		let youtubeSection = 'misc';
		if (href.includes('/watch?')) {
			youtubeSection = 'watch';
		} else if (href.match(REGEX_CHANNEL) || href.match(REGEX_USER)) {
			youtubeSection = 'channel';
		} else if (href.includes('/feed/subscriptions')) {
			youtubeSection = 'subscriptions';
		} else if (href.includes('/feed/trending')) {
			youtubeSection = 'trending';
		} else if (href.includes('/playlist?')) {
			youtubeSection = 'playlist';
		} else if (href.includes('/results?')) {
			youtubeSection = 'search';
		}

		return youtubeSection;
	};

	// ===========================================================

	const getWatchedItemContainer = (item, section) => {
		if (section === 'subscriptions') {
			return (
				item.closest('.ytd-grid-renderer') ||
				item.closest('.ytd-item-section-renderer') ||
				item.closest('.ytd-rich-grid-row') ||
				item.closest('.ytd-rich-grid-renderer') ||
				item.closest('#grid-container')
			);
		} else if (section === 'playlist') {
			return item.closest('ytd-playlist-video-renderer');
		} else if (section === 'watch') {
			let watchedItem =
				item.closest('ytd-compact-video-renderer') ||
				item.closest('yt-lockup-view-model');
			if (watchedItem?.closest('ytd-compact-autoplay-renderer')) {
				watchedItem = null;
			}
			return watchedItem;
		} else {
			return (
				item.closest('ytd-rich-item-renderer') ||
				item.closest('ytd-video-renderer') ||
				item.closest('ytd-grid-video-renderer')
			);
		}
	};

	const updateClassOnWatchedItems = () => {
		// Remove existing classes
		document
			.querySelectorAll('.YT-HWV-WATCHED-DIMMED')
			.forEach((el) => el.classList.remove('YT-HWV-WATCHED-DIMMED'));
		document
			.querySelectorAll('.YT-HWV-WATCHED-HIDDEN')
			.forEach((el) => el.classList.remove('YT-HWV-WATCHED-HIDDEN'));
		document
			.querySelectorAll('.YT-HWV-FULLY-WATCHED-HIDDEN')
			.forEach((el) => el.classList.remove('YT-HWV-FULLY-WATCHED-HIDDEN'));

		// If we're on the History page -- do nothing. We don't want to hide watched videos here.
		if (window.location.href.indexOf('/feed/history') >= 0) return;

		const section = determineYoutubeSection();
		const state = localStorage[`YTHWV_STATE_${section}`];

		// Mode: fullyWatched - only hide videos that are >= 95% watched
		if (state === 'fullyWatched') {
			findFullyWatchedElements().forEach((item) => {
				const watchedItem = getWatchedItemContainer(item, section);
				if (watchedItem) {
					watchedItem.classList.add('YT-HWV-FULLY-WATCHED-HIDDEN');
				}
			});
			return;
		}

		findWatchedElements().forEach((item, _i) => {
			let watchedItem = getWatchedItemContainer(item, section);
			let dimmedItem;

			// If we're hiding the .ytd-item-section-renderer element, we need to give it
			// some extra spacing otherwise we'll get stuck in infinite page loading
			if (section === 'subscriptions' && watchedItem?.classList.contains('ytd-item-section-renderer')) {
				watchedItem
					.closest('ytd-item-section-renderer')
					.classList.add('YT-HWV-HIDDEN-ROW-PARENT');
			}

			// For playlist items in watch section, we never hide them, but we will dim them
			if (section === 'watch' && !watchedItem) {
				const watchedItemInPlaylist = item.closest('ytd-playlist-panel-video-renderer');
				if (watchedItemInPlaylist) {
					dimmedItem = watchedItemInPlaylist;
				}
			}

			if (watchedItem) {
				if (state === 'dimmed') {
					watchedItem.classList.add('YT-HWV-WATCHED-DIMMED');
				} else if (state === 'hidden') {
					watchedItem.classList.add('YT-HWV-WATCHED-HIDDEN');
				}
			}

			if (dimmedItem && (state === 'dimmed' || state === 'hidden')) {
				dimmedItem.classList.add('YT-HWV-WATCHED-DIMMED');
			}
		});
	};

	// ===========================================================

	const renderButtons = () => {
		// Find button area target
		const target = findButtonAreaTarget();
		if (!target) return;

		// Did we already render the buttons?
		const existingButtons = document.querySelector('.YT-HWV-BUTTONS');

		// Generate buttons area DOM
		const buttonArea = document.createElement('div');
		buttonArea.classList.add('YT-HWV-BUTTONS');

		// Render button
		const { icon, iconDimmed, iconHidden, iconFullyWatched, name, stateKey } = BUTTON;
		const section = determineYoutubeSection();
		const storageKey = [stateKey, section].join('_');
		const toggleButtonState = localStorage.getItem(storageKey) || 'normal';

		const button = document.createElement('button');
		button.title = `${name} : currently "${toggleButtonState}" for section "${section}"`;
		button.classList.add('YT-HWV-BUTTON');
		if (toggleButtonState !== 'normal')
			button.classList.add('YT-HWV-BUTTON-DISABLED');

		// Select icon based on state
		let buttonIcon = icon;
		if (toggleButtonState === 'dimmed') buttonIcon = iconDimmed;
		else if (toggleButtonState === 'hidden') buttonIcon = iconHidden;
		else if (toggleButtonState === 'fullyWatched') buttonIcon = iconFullyWatched;
		button.innerHTML = buttonIcon;
		buttonArea.appendChild(button);

		button.addEventListener('click', () => {
			logDebug(`Button ${name} clicked. State: ${toggleButtonState}`);

			// Cycle: normal -> dimmed -> hidden -> fullyWatched -> normal
			let newState = 'dimmed';
			if (toggleButtonState === 'dimmed') {
				newState = 'hidden';
			} else if (toggleButtonState === 'hidden') {
				newState = 'fullyWatched';
			} else if (toggleButtonState === 'fullyWatched') {
				newState = 'normal';
			}

			localStorage.setItem(storageKey, newState);

			applyImmediateHidingCSS();
			updateClassOnWatchedItems();
			renderButtons();
		});

		// Insert buttons into DOM
		if (existingButtons) {
			target.parentNode.replaceChild(buttonArea, existingButtons);
			logDebug('Re-rendered menu buttons');
		} else {
			target.parentNode.insertBefore(buttonArea, target);
			logDebug('Rendered menu buttons');
		}
	};

	// ===========================================================
	// Thumbnail action buttons (like/dislike/watched)

	const getVideoIdFromThumbnail = (thumbnail) => {
		const link = thumbnail.querySelector('a#thumbnail, a.yt-simple-endpoint');
		if (!link) return null;
		const href = link.getAttribute('href');
		if (!href) return null;
		const match = href.match(/[?&]v=([^&]+)/);
		return match ? match[1] : null;
	};

	const clickYouTubeButton = (videoId, buttonType) => {
		// Open video in background, find and click the button, then close
		// This is a workaround since YouTube API requires authentication
		const url = `https://www.youtube.com/watch?v=${videoId}`;
		const iframe = document.createElement('iframe');
		iframe.style.display = 'none';
		iframe.src = url;
		document.body.appendChild(iframe);

		iframe.onload = () => {
			setTimeout(() => {
				try {
					const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
					let btn;
					if (buttonType === 'like') {
						btn = iframeDoc.querySelector('like-button-view-model button, #segmented-like-button button, button[aria-label*="like" i]:not([aria-label*="dislike"])');
					} else if (buttonType === 'dislike') {
						btn = iframeDoc.querySelector('dislike-button-view-model button, #segmented-dislike-button button, button[aria-label*="dislike" i]');
					}
					if (btn) btn.click();
				} catch (e) {
					logDebug('Cannot access iframe content (CORS)', e);
				}
				setTimeout(() => iframe.remove(), 500);
			}, 2000);
		};
	};

	const markVideoAsWatched = (videoId) => {
		// Jump to near end of video to mark as watched
		const url = `https://www.youtube.com/watch?v=${videoId}&t=9999999`;
		const iframe = document.createElement('iframe');
		iframe.style.display = 'none';
		iframe.src = url;
		document.body.appendChild(iframe);
		setTimeout(() => iframe.remove(), 3000);
		logDebug(`Marked video ${videoId} as watched`);
	};

	const addThumbnailActions = () => {
		const thumbnails = document.querySelectorAll('ytd-thumbnail:not([data-ythwv-actions])');

		thumbnails.forEach((thumbnail) => {
			const videoId = getVideoIdFromThumbnail(thumbnail);
			if (!videoId) return;

			thumbnail.setAttribute('data-ythwv-actions', 'true');
			thumbnail.style.position = 'relative';

			const actionsDiv = document.createElement('div');
			actionsDiv.classList.add('YT-HWV-THUMB-ACTIONS');

			// Like button
			const likeBtn = document.createElement('button');
			likeBtn.classList.add('YT-HWV-THUMB-BTN');
			likeBtn.innerHTML = ICONS.like;
			likeBtn.title = 'Like';
			likeBtn.addEventListener('click', (e) => {
				e.preventDefault();
				e.stopPropagation();
				likeBtn.classList.toggle('liked');
				clickYouTubeButton(videoId, 'like');
			});

			// Dislike button
			const dislikeBtn = document.createElement('button');
			dislikeBtn.classList.add('YT-HWV-THUMB-BTN');
			dislikeBtn.innerHTML = ICONS.dislike;
			dislikeBtn.title = 'Dislike';
			dislikeBtn.addEventListener('click', (e) => {
				e.preventDefault();
				e.stopPropagation();
				dislikeBtn.classList.toggle('disliked');
				clickYouTubeButton(videoId, 'dislike');
			});

			// Watched button
			const watchedBtn = document.createElement('button');
			watchedBtn.classList.add('YT-HWV-THUMB-BTN');
			watchedBtn.innerHTML = ICONS.watched;
			watchedBtn.title = 'Mark as watched';
			watchedBtn.addEventListener('click', (e) => {
				e.preventDefault();
				e.stopPropagation();
				watchedBtn.classList.add('active');
				markVideoAsWatched(videoId);
			});

			actionsDiv.appendChild(likeBtn);
			actionsDiv.appendChild(dislikeBtn);
			actionsDiv.appendChild(watchedBtn);
			thumbnail.appendChild(actionsDiv);
		});
	};

	// ===========================================================
	// Video page watched button

	const addVideoPageWatchedButton = () => {
		if (!window.location.href.includes('/watch')) return;
		if (document.querySelector('.YT-HWV-VIDEO-WATCHED-BTN')) return;

		// Find the segmented like/dislike button container
		const segmentedContainer = document.querySelector(
			'ytd-segmented-like-dislike-button-renderer, segmented-like-dislike-button-view-model'
		);
		if (!segmentedContainer) return;

		const watchedBtn = document.createElement('button');
		watchedBtn.classList.add('YT-HWV-VIDEO-WATCHED-BTN');
		watchedBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>';
		watchedBtn.title = 'Mark as watched';

		watchedBtn.addEventListener('click', () => {
			watchedBtn.classList.add('active');
			jumpToEndOfVideo();
		});

		// Add class to modify dislike button border radius
		segmentedContainer.classList.add('YT-HWV-SEGMENTED-MODIFIED');
		segmentedContainer.appendChild(watchedBtn);
		logDebug('Added video page watched button');
	};

	// ===========================================================

	const run = debounce((mutations) => {
		// Don't react if only our own buttons changed state to avoid running an endless loop
		if (
			mutations &&
			mutations.length === 1 &&
			mutations[0].target.classList.contains('YT-HWV-BUTTON')
		) {
			return;
		}

		logDebug('Running check for watched videos');
		updateClassOnWatchedItems();
		renderButtons();
		addThumbnailActions();
		addVideoPageWatchedButton();
	}, 250);

	// ===========================================================

	// Hijack all XHR calls
	const send = XMLHttpRequest.prototype.send;
	XMLHttpRequest.prototype.send = function (data) {
		this.addEventListener(
			'readystatechange',
			function () {
				if (
					// Anytime more videos are fetched -- re-run script
					this.responseURL.indexOf('browse_ajax?action_continuation') > 0
				) {
					setTimeout(() => {
						run();
					}, 0);
				}
			},
			false,
		);
		send.call(this, data);
	};

	// ===========================================================

	const observeDOM = (() => {
		const MutationObserver =
			window.MutationObserver || window.WebKitMutationObserver;
		const eventListenerSupported = window.addEventListener;

		return (obj, callback) => {
			logDebug('Attaching DOM listener');

			// Invalid `obj` given
			if (!obj) return;

			if (MutationObserver) {
				const obs = new MutationObserver((mutations, _observer) => {
					// If the mutation is the script's own buttons being injected, ignore the event
					if (
						mutations.length === 1 &&
						mutations[0].addedNodes?.length === 1 &&
						mutations[0].addedNodes[0].classList.contains('YT-HWV-BUTTONS')
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

	// ===========================================================
	// Like/Dislike -> Jump to end of video (so YouTube remembers it as watched)

	const jumpToEndOfVideo = () => {
		const video = document.querySelector('video');
		if (video && video.duration) {
			video.currentTime = video.duration - 0.1;
			logDebug('Jumped to end of video after like/dislike');
		}
	};

	const setupLikeDislikeListener = () => {
		document.addEventListener('click', (e) => {
			const target = e.target.closest('button');
			if (!target) return;

			// Check if it's a like or dislike button
			const ariaLabel = target.getAttribute('aria-label') || '';
			const isLikeButton = ariaLabel.toLowerCase().includes('like') &&
				!ariaLabel.toLowerCase().includes('dislike');
			const isDislikeButton = ariaLabel.toLowerCase().includes('dislike');

			if ((isLikeButton || isDislikeButton) && window.location.href.includes('/watch')) {
				// Small delay to let YouTube process the click first
				setTimeout(jumpToEndOfVideo, 100);
			}
		}, true);
	};

	// ===========================================================

	logDebug('Starting Script');

	// YouTube does navigation via history and also does a bunch
	// of AJAX video loading. In order to ensure we're always up
	// to date, we have to listen for ANY DOM change event, and
	// re-run our script.
	observeDOM(document.body, run);

	setupLikeDislikeListener();

	// Aggressively try to render buttons ASAP
	const earlyButtonInjection = setInterval(() => {
		const target = findButtonAreaTarget();
		if (target) {
			renderButtons();
			clearInterval(earlyButtonInjection);
			logDebug('Early button injection successful');
		}
	}, 100);

	// Clear interval after 10 seconds to avoid running forever
	setTimeout(() => clearInterval(earlyButtonInjection), 10000);

	run();
})();