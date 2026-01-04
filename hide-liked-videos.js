// ==UserScript==
// @name         youtube-inbox: hide rated videos
// @namespace    http://github.com/marklidenberg/youtube-inbox
// @version      1.0
// @license      MIT
// @description  Dim or hide videos that you've already rated (liked or disliked)
// @author       Mark Lidenberg
// @match        http://*.youtube.com/*
// @match        https://*.youtube.com/*
// @noframes
// @grant        GM_xmlhttpRequest
// @connect      youtube.com
// ==/UserScript==

// Repository: http://github.com/marklidenberg/youtube-inbox

(() => {
	// Bypass YouTube's Trusted Types restrictions
	if (typeof trustedTypes !== 'undefined' && trustedTypes.defaultPolicy === null) {
		trustedTypes.createPolicy('default', { createHTML: (s) => s, createScript: (s) => s, createScriptURL: (s) => s });
	}

	const STORAGE_KEY = 'YT_HIDE_RATED_STATE';
	const CACHE_KEY = 'YT_HIDE_RATED_CACHE';

	// States: 'normal' (show all), 'dimmed' (dim rated), 'hidden' (hide rated)
	const getState = () => localStorage.getItem(STORAGE_KEY) || 'normal';
	const setState = (state) => localStorage.setItem(STORAGE_KEY, state);

	// Cache for rated videos (only stores videos that ARE rated)
	const getCache = () => {
		try {
			return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
		} catch {
			return {};
		}
	};
	const setCache = (cache) => localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
	const getCachedRating = (videoId) => getCache()[videoId] || null;
	const setCachedRating = (videoId, rating) => {
		// Only cache if video IS rated (like or dislike)
		if (rating) {
			const cache = getCache();
			cache[videoId] = rating;
			setCache(cache);
		}
	};

	// Add styles
	const style = document.createElement('style');
	style.textContent = `
.YT-HRV-RATED-HIDDEN { display: none !important; }
.YT-HRV-RATED-DIMMED { opacity: 0.3; }

.YT-HRV-BUTTONS {
	background: transparent;
	border: 1px solid var(--ytd-searchbox-legacy-border-color);
	border-radius: 40px;
	display: flex;
	gap: 5px;
	margin: 0 20px;
}

.YT-HRV-BUTTON {
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

.YT-HRV-BUTTON:focus,
.YT-HRV-BUTTON:hover {
	background: var(--yt-spec-badge-chip-background);
}

.YT-HRV-BUTTON-DISABLED {
	color: var(--yt-spec-icon-disabled);
}
`;
	document.head.appendChild(style);

	// Extract video ID from various YouTube elements
	const extractVideoId = (element) => {
		// Try href attribute
		const link = element.querySelector('a#thumbnail, a.ytd-thumbnail, a[href*="watch"]');
		if (link) {
			const href = link.getAttribute('href');
			if (href) {
				const match = href.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
				if (match) return match[1];
			}
		}

		// Try data attributes
		const videoId = element.getAttribute('data-video-id');
		if (videoId) return videoId;

		// Try finding in child elements
		const thumbnail = element.querySelector('ytd-thumbnail');
		if (thumbnail) {
			const thumbLink = thumbnail.querySelector('a');
			if (thumbLink) {
				const href = thumbLink.getAttribute('href');
				if (href) {
					const match = href.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
					if (match) return match[1];
				}
			}
		}

		return null;
	};

	// Find all video elements on the page
	const findVideoElements = () => {
		const selectors = [
			'ytd-rich-item-renderer',
			'ytd-video-renderer',
			'ytd-grid-video-renderer',
			'ytd-compact-video-renderer',
			'ytd-playlist-video-renderer',
		];

		const elements = document.querySelectorAll(selectors.join(','));
		const result = [];

		elements.forEach(el => {
			const videoId = extractVideoId(el);
			if (videoId && !el.classList.contains('YT-HRV-PROCESSED')) {
				result.push({ element: el, videoId });
			}
		});

		return result;
	};

	// Get SAPISIDHASH for YouTube API authentication
	const getSapisidHash = async () => {
		const sapisid = document.cookie.split('; ').find(c => c.startsWith('SAPISID='));
		if (!sapisid) return null;

		const sapisidValue = sapisid.split('=')[1];
		const timestamp = Math.floor(Date.now() / 1000);
		const origin = 'https://www.youtube.com';

		const hashInput = `${timestamp} ${sapisidValue} ${origin}`;
		const hashBuffer = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(hashInput));
		const hashArray = Array.from(new Uint8Array(hashBuffer));
		const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

		return `SAPISIDHASH ${timestamp}_${hashHex}`;
	};

	// Batch check videos for rating status
	const checkVideosRatingBatch = async (videoIds) => {
		const results = {};
		const uncachedIds = [];

		// First, check cache for already-rated videos
		for (const videoId of videoIds) {
			const cached = getCachedRating(videoId);
			if (cached) {
				results[videoId] = cached;
			} else {
				uncachedIds.push(videoId);
			}
		}

		// Only fetch uncached videos
		if (uncachedIds.length === 0) {
			return results;
		}

		// Check videos individually (YouTube doesn't have a batch API for this)
		// To avoid rate limiting, check in smaller batches with delays
		const BATCH_SIZE = 3;
		const DELAY_MS = 500;

		for (let i = 0; i < uncachedIds.length; i += BATCH_SIZE) {
			const batch = uncachedIds.slice(i, i + BATCH_SIZE);

			await Promise.all(batch.map(async (videoId) => {
				const rating = await checkSingleVideoRating(videoId);
				results[videoId] = rating;
				// Cache only rated videos (not unrated ones)
				setCachedRating(videoId, rating);
			}));

			if (i + BATCH_SIZE < uncachedIds.length) {
				await new Promise(resolve => setTimeout(resolve, DELAY_MS));
			}

			// Update progress
			updateProgress(Object.keys(results).length, videoIds.length);
		}

		return results;
	};

	// Check single video rating (returns 'like', 'dislike', or false)
	const checkSingleVideoRating = async (videoId) => {
		try {
			const authHeader = await getSapisidHash();
			if (!authHeader) return false;

			const apiKey = window.ytcfg?.data_?.INNERTUBE_API_KEY || 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';

			// Use the updated API endpoint to get video info including like status
			const response = await fetch(`https://www.youtube.com/youtubei/v1/next?key=${apiKey}`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': authHeader,
					'X-Origin': 'https://www.youtube.com',
				},
				body: JSON.stringify({
					context: {
						client: {
							clientName: 'WEB',
							clientVersion: '2.20240101.00.00',
						}
					},
					videoId: videoId
				}),
				credentials: 'include'
			});

			const data = await response.json();

			// Navigate through the response to find like/dislike status
			const contents = data?.contents?.twoColumnWatchNextResults?.results?.results?.contents || [];
			for (const content of contents) {
				const videoPrimaryInfo = content?.videoPrimaryInfoRenderer;
				if (videoPrimaryInfo) {
					const menuRenderer = videoPrimaryInfo?.videoActions?.menuRenderer;
					const topLevelButtons = menuRenderer?.topLevelButtons || [];

					for (const button of topLevelButtons) {
						const segmentedLike = button?.segmentedLikeDislikeButtonRenderer ||
						                      button?.segmentedLikeDislikeButtonViewModel;
						if (segmentedLike) {
							// Check like button status
							const likeButton = segmentedLike?.likeButton?.likeButtonRenderer ||
							                   segmentedLike?.likeButtonViewModel?.likeButtonViewModel;
							if (likeButton) {
								const likeStatus = likeButton?.likeStatusEntity?.likeStatus;
								if (likeStatus === 'LIKE' || likeButton?.isToggled === true) {
									return 'like';
								}
								if (likeStatus === 'DISLIKE') {
									return 'dislike';
								}
							}

							// Check dislike button status separately
							const dislikeButton = segmentedLike?.dislikeButton?.dislikeButtonRenderer ||
							                      segmentedLike?.dislikeButtonViewModel?.dislikeButtonViewModel;
							if (dislikeButton?.isToggled === true) {
								return 'dislike';
							}
						}
					}
				}
			}

			return false;
		} catch (error) {
			console.error('YT-HRV: Error checking video:', videoId, error);
			return false;
		}
	};

	// Progress tracking (for future use - could add progress indicator)
	const updateProgress = (_current, _total) => {
		// Progress display could be added here if needed
	};

	// Apply visual state to video elements
	const applyState = (element, rating) => {
		const state = getState();

		// Remove all state classes first
		element.classList.remove('YT-HRV-RATED-HIDDEN', 'YT-HRV-RATED-DIMMED');

		if (!rating) return;

		if (state === 'hidden') {
			element.classList.add('YT-HRV-RATED-HIDDEN');
		} else if (state === 'dimmed') {
			element.classList.add('YT-HRV-RATED-DIMMED');
		}
	};

	// Store rating status on elements
	const ratingStatusMap = new Map();

	// Process all videos on the page
	const processVideos = async () => {
		const videos = findVideoElements();
		if (videos.length === 0) return;

		const videoIds = videos.map(v => v.videoId);

		// Mark as processed
		videos.forEach(({ element }) => {
			element.classList.add('YT-HRV-PROCESSED');
		});

		// Check rating status
		const ratingStatus = await checkVideosRatingBatch(videoIds);

		// Apply results
		videos.forEach(({ element, videoId }) => {
			const rating = ratingStatus[videoId] || false;
			ratingStatusMap.set(element, rating);
			applyState(element, rating);
		});
	};

	// Re-apply state to all processed elements (when state changes)
	const reapplyAllStates = () => {
		ratingStatusMap.forEach((rating, element) => {
			applyState(element, rating);
		});
	};

	// Icons (same as hide-watched-videos.js - eye icons)
	const ICONS = {
		// Normal - show all rated videos (eye icon)
		normal: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 48 48"><path fill="currentColor" d="M24 9C14 9 5.46 15.22 2 24c3.46 8.78 12 15 22 15 10.01 0 18.54-6.22 22-15-3.46-8.78-11.99-15-22-15zm0 25c-5.52 0-10-4.48-10-10s4.48-10 10-10 10 4.48 10 10-4.48 10-10 10zm0-16c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6z"/></svg>',
		// Dimmed - dim rated videos (eye with opacity)
		dimmed: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 48 48"><path fill="currentColor" opacity="0.5" d="M24 9C14 9 5.46 15.22 2 24c3.46 8.78 12 15 22 15 10.01 0 18.54-6.22 22-15-3.46-8.78-11.99-15-22-15zm0 25c-5.52 0-10-4.48-10-10s4.48-10 10-10 10 4.48 10 10-4.48 10-10 10zm0-16c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6z"/></svg>',
		// Hidden - hide rated videos (eye with slash)
		hidden: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 48 48"><path fill="currentColor" d="M24 14c5.52 0 10 4.48 10 10 0 1.29-.26 2.52-.71 3.65l5.85 5.85c3.02-2.52 5.4-5.78 6.87-9.5-3.47-8.78-12-15-22.01-15-2.8 0-5.48.5-7.97 1.4l4.32 4.31c1.13-.44 2.36-.71 3.65-.71zM4 8.55l4.56 4.56.91.91C6.17 16.6 3.56 20.03 2 24c3.46 8.78 12 15 22 15 3.1 0 6.06-.6 8.77-1.69l.85.85L39.45 44 42 41.46 6.55 6 4 8.55zM15.06 19.6l3.09 3.09c-.09.43-.15.86-.15 1.31 0 3.31 2.69 6 6 6 .45 0 .88-.06 1.3-.15l3.09 3.09C27.06 33.6 25.58 34 24 34c-5.52 0-10-4.48-10-10 0-1.58.4-3.06 1.06-4.4zm8.61-1.57 6.3 6.3L30 24c0-3.31-2.69-6-6-6l-.33.03z"/></svg>',
	};

	// Render buttons in header
	const renderButtons = () => {
		const target = document.querySelector('#container #end #buttons');
		if (!target) return;

		const existing = document.querySelector('.YT-HRV-BUTTONS');
		if (existing) existing.remove();

		const state = getState();

		const buttonArea = document.createElement('div');
		buttonArea.classList.add('YT-HRV-BUTTONS');

		const button = document.createElement('button');
		button.classList.add('YT-HRV-BUTTON');
		if (state !== 'normal') button.classList.add('YT-HRV-BUTTON-DISABLED');

		button.innerHTML = ICONS[state] || ICONS.normal;
		button.title = `Toggle rated videos: currently "${state}"`;

		button.addEventListener('click', () => {
			// Cycle: normal -> dimmed -> hidden -> normal
			let newState = 'dimmed';
			if (state === 'dimmed') newState = 'hidden';
			else if (state === 'hidden') newState = 'normal';

			setState(newState);
			reapplyAllStates();
			renderButtons();
		});

		buttonArea.appendChild(button);

		target.parentNode.insertBefore(buttonArea, target);
	};

	// Debounce helper
	const debounce = (func, wait) => {
		let timeout;
		return (...args) => {
			clearTimeout(timeout);
			timeout = setTimeout(() => func.apply(this, args), wait);
		};
	};

	// Main run function
	const run = debounce(() => {
		renderButtons();
		// Auto-scan if state is not normal
		if (getState() !== 'normal') {
			processVideos();
		}
	}, 500);

	// Observe DOM changes
	const observer = new MutationObserver((mutations) => {
		// Ignore our own changes
		const dominated = mutations.some(m =>
			m.target.classList?.contains('YT-HRV-BUTTON') ||
			m.target.closest?.('.YT-HRV-BUTTONS')
		);
		if (dominated) return;

		run();
	});

	observer.observe(document.body, { childList: true, subtree: true });

	// Initial run
	run();

	// Also run on navigation
	window.addEventListener('yt-navigate-finish', run);
})();
