// ==UserScript==
// @name         youtube-inbox: hide watched or rated videos
// @namespace    http://github.com/marklidenberg/youtube-inbox
// @version      1.1
// @license      MIT
// @description  Dim or hide videos that you've already watched or rated (liked or disliked)
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

	const STORAGE_KEY = 'YT_HIDE_WATCHED_RATED_STATE';
	const CACHE_KEY = 'YT_HIDE_WATCHED_RATED_CACHE';
	const WATCHED_THRESHOLD_PERCENT = 90;

	// States: 'normal' (show all), 'dimmed' (dim watched/rated), 'hidden' (hide watched/rated)
	const getState = () => localStorage.getItem(STORAGE_KEY) || 'normal';
	const setState = (state) => localStorage.setItem(STORAGE_KEY, state);

	// Cache for watched/rated videos (stores: 'watched', 'like', or 'dislike')
	const getCache = () => {
		try {
			return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
		} catch {
			return {};
		}
	};
	const setCache = (cache) => localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
	const getCachedStatus = (videoId) => getCache()[videoId] || null;
	const setCachedStatus = (videoId, status) => {
		// Only cache if video has a status (watched, like, or dislike)
		if (status) {
			const cache = getCache();
			cache[videoId] = status;
			setCache(cache);
		}
	};

	// Add styles
	const style = document.createElement('style');
	style.textContent = `
.YT-HRV-RATED-HIDDEN { display: none !important; }
.YT-HRV-RATED-DIMMED { opacity: 0.3; }

.YT-HRV-LOADING {
	opacity: 0.3;
	filter: grayscale(100%) brightness(2);
}

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

/* Thumbnail hover buttons */
.YT-HRV-THUMB-BUTTONS {
	position: absolute;
	bottom: 8px;
	right: 8px;
	display: flex;
	gap: 4px;
	opacity: 0;
	transition: opacity 0.2s ease;
	z-index: 100;
}

ytd-thumbnail:hover .YT-HRV-THUMB-BUTTONS,
.YT-HRV-THUMB-BUTTONS:focus-within {
	opacity: 1;
}

.YT-HRV-THUMB-BTN {
	width: 32px;
	height: 32px;
	border: none;
	border-radius: 50%;
	background: rgba(0, 0, 0, 0.7);
	color: white;
	cursor: pointer;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 0;
	transition: background 0.2s ease, transform 0.1s ease;
}

.YT-HRV-THUMB-BTN:hover {
	background: rgba(0, 0, 0, 0.9);
	transform: scale(1.1);
}

.YT-HRV-THUMB-BTN svg {
	width: 18px;
	height: 18px;
}

.YT-HRV-THUMB-BTN-LIKED {
	background: rgba(6, 95, 212, 0.9);
}

.YT-HRV-THUMB-BTN-LIKED:hover {
	background: rgba(6, 95, 212, 1);
}

.YT-HRV-THUMB-BTN-DISLIKED {
	background: rgba(204, 0, 0, 0.9);
}

.YT-HRV-THUMB-BTN-DISLIKED:hover {
	background: rgba(204, 0, 0, 1);
}

.YT-HRV-THUMB-BTN:disabled {
	opacity: 0.5;
	cursor: not-allowed;
}
`;
	document.head.appendChild(style);

	// Find all watched progress bar elements on the page (exact logic from hide-watched-videos.js)
	const findWatchedProgressBars = () => {
		const watched = document.querySelectorAll([
			'.ytd-thumbnail-overlay-resume-playback-renderer',
			'.ytThumbnailOverlayProgressBarHostWatchedProgressBarSegment',
			'.ytThumbnailOverlayProgressBarHostWatchedProgressBarSegmentModern',
		].join(','));

		const withThreshold = Array.from(watched).filter((bar) => {
			return (
				bar.style.width &&
				Number.parseInt(bar.style.width, 10) >= WATCHED_THRESHOLD_PERCENT
			);
		});

		return withThreshold;
	};

	// Get the video container element from a progress bar element
	const getVideoContainerFromProgressBar = (progressBar) => {
		return (
			progressBar.closest('ytd-rich-item-renderer') ||
			progressBar.closest('ytd-video-renderer') ||
			progressBar.closest('ytd-grid-video-renderer') ||
			progressBar.closest('ytd-compact-video-renderer') ||
			progressBar.closest('ytd-playlist-video-renderer') ||
			progressBar.closest('yt-lockup-view-model')
		);
	};

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

	// Batch check videos for rating status (like/dislike)
	const checkVideosRatingBatch = async (videoIds, onVideoChecked) => {
		const results = {};
		const uncachedIds = [];

		// First, check cache for already-rated videos
		for (const videoId of videoIds) {
			const cached = getCachedStatus(videoId);
			if (cached) {
				results[videoId] = cached;
				onVideoChecked(videoId, cached);
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
		const BATCH_SIZE = 5;
		const DELAY_MS = 500;

		for (let i = 0; i < uncachedIds.length; i += BATCH_SIZE) {
			const batch = uncachedIds.slice(i, i + BATCH_SIZE);

			await Promise.all(batch.map(async (videoId) => {
				const rating = await checkSingleVideoRating(videoId);
				results[videoId] = rating;
				// Cache only rated videos (not unrated ones)
				setCachedStatus(videoId, rating);
				// Apply state immediately
				onVideoChecked(videoId, rating);
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

	// Rate a video (like, dislike, or remove rating)
	const rateVideo = async (videoId, rating) => {
		try {
			const authHeader = await getSapisidHash();
			if (!authHeader) {
				console.error('YT-HRV: Not authenticated');
				return false;
			}

			const apiKey = window.ytcfg?.data_?.INNERTUBE_API_KEY || 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';

			const response = await fetch(`https://www.youtube.com/youtubei/v1/like/${rating}?key=${apiKey}`, {
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
					target: {
						videoId: videoId
					}
				}),
				credentials: 'include'
			});

			if (!response.ok) {
				console.error('YT-HRV: Failed to rate video', response.status);
				return false;
			}

			return true;
		} catch (error) {
			console.error('YT-HRV: Error rating video:', videoId, error);
			return false;
		}
	};

	// Apply visual state to video elements based on status ('watched', 'like', 'dislike', or false)
	const applyState = (element, status) => {
		const state = getState();

		// Remove all state classes first
		element.classList.remove('YT-HRV-RATED-HIDDEN', 'YT-HRV-RATED-DIMMED', 'YT-HRV-LOADING');

		// If no status (not watched and not rated), don't apply any visual changes
		if (!status) return;

		if (state === 'hidden') {
			element.classList.add('YT-HRV-RATED-HIDDEN');
		} else if (state === 'dimmed') {
			element.classList.add('YT-HRV-RATED-DIMMED');
		}
	};

	// Create thumbnail hover buttons for a video element
	const createThumbButtons = (element, videoId, currentRating) => {
		const thumbnail = element.querySelector('ytd-thumbnail, a#thumbnail');
		if (!thumbnail) return;

		// Check if buttons already exist
		if (thumbnail.querySelector('.YT-HRV-THUMB-BUTTONS')) return;

		// Ensure thumbnail has position relative for absolute positioning of buttons
		const computedStyle = window.getComputedStyle(thumbnail);
		if (computedStyle.position === 'static') {
			thumbnail.style.position = 'relative';
		}

		const buttonContainer = document.createElement('div');
		buttonContainer.classList.add('YT-HRV-THUMB-BUTTONS');

		// Like button
		const likeBtn = document.createElement('button');
		likeBtn.classList.add('YT-HRV-THUMB-BTN');
		if (currentRating === 'like') {
			likeBtn.classList.add('YT-HRV-THUMB-BTN-LIKED');
		}
		likeBtn.innerHTML = currentRating === 'like' ? THUMB_ICONS.likeFilled : THUMB_ICONS.like;
		likeBtn.title = currentRating === 'like' ? 'Remove like' : 'Like';
		likeBtn.addEventListener('click', async (e) => {
			e.preventDefault();
			e.stopPropagation();
			await handleThumbButtonClick(element, videoId, 'like', likeBtn, buttonContainer);
		});

		// Dislike button
		const dislikeBtn = document.createElement('button');
		dislikeBtn.classList.add('YT-HRV-THUMB-BTN');
		if (currentRating === 'dislike') {
			dislikeBtn.classList.add('YT-HRV-THUMB-BTN-DISLIKED');
		}
		dislikeBtn.innerHTML = currentRating === 'dislike' ? THUMB_ICONS.dislikeFilled : THUMB_ICONS.dislike;
		dislikeBtn.title = currentRating === 'dislike' ? 'Remove dislike' : 'Dislike';
		dislikeBtn.addEventListener('click', async (e) => {
			e.preventDefault();
			e.stopPropagation();
			await handleThumbButtonClick(element, videoId, 'dislike', dislikeBtn, buttonContainer);
		});

		buttonContainer.appendChild(likeBtn);
		buttonContainer.appendChild(dislikeBtn);
		thumbnail.appendChild(buttonContainer);
	};

	// Handle thumb button click
	const handleThumbButtonClick = async (element, videoId, action, _clickedBtn, container) => {
		const currentRating = statusMap.get(element) || false;
		const likeBtn = container.querySelector('.YT-HRV-THUMB-BTN:first-child');
		const dislikeBtn = container.querySelector('.YT-HRV-THUMB-BTN:last-child');

		// Disable buttons during operation
		likeBtn.disabled = true;
		dislikeBtn.disabled = true;

		let newRating;
		let apiAction;

		if (action === 'like') {
			if (currentRating === 'like') {
				// Remove like
				apiAction = 'removelike';
				newRating = false;
			} else {
				// Add like
				apiAction = 'like';
				newRating = 'like';
			}
		} else {
			if (currentRating === 'dislike') {
				// Remove dislike
				apiAction = 'removedislike';
				newRating = false;
			} else {
				// Add dislike
				apiAction = 'dislike';
				newRating = 'dislike';
			}
		}

		const success = await rateVideo(videoId, apiAction);

		if (success) {
			// Update cache
			if (newRating) {
				setCachedStatus(videoId, newRating);
			} else {
				// Remove from cache if unrated
				const cache = getCache();
				delete cache[videoId];
				setCache(cache);
			}

			// Update rating status map
			statusMap.set(element, newRating);

			// Update button states
			likeBtn.classList.remove('YT-HRV-THUMB-BTN-LIKED');
			dislikeBtn.classList.remove('YT-HRV-THUMB-BTN-DISLIKED');

			if (newRating === 'like') {
				likeBtn.classList.add('YT-HRV-THUMB-BTN-LIKED');
				likeBtn.innerHTML = THUMB_ICONS.likeFilled;
				likeBtn.title = 'Remove like';
				dislikeBtn.innerHTML = THUMB_ICONS.dislike;
				dislikeBtn.title = 'Dislike';
			} else if (newRating === 'dislike') {
				dislikeBtn.classList.add('YT-HRV-THUMB-BTN-DISLIKED');
				dislikeBtn.innerHTML = THUMB_ICONS.dislikeFilled;
				dislikeBtn.title = 'Remove dislike';
				likeBtn.innerHTML = THUMB_ICONS.like;
				likeBtn.title = 'Like';
			} else {
				likeBtn.innerHTML = THUMB_ICONS.like;
				likeBtn.title = 'Like';
				dislikeBtn.innerHTML = THUMB_ICONS.dislike;
				dislikeBtn.title = 'Dislike';
			}

			// Re-apply visual state (dim/hide)
			applyState(element, newRating);
		}

		// Re-enable buttons
		likeBtn.disabled = false;
		dislikeBtn.disabled = false;
	};

	// Store video status on elements ('watched', 'like', 'dislike', or false)
	const statusMap = new Map();

	// Set of elements already marked as watched (to avoid re-processing)
	const watchedElements = new Set();

	// Process watched videos first (from progress bars - no API calls needed)
	const processWatchedVideos = () => {
		const progressBars = findWatchedProgressBars();

		for (const bar of progressBars) {
			const container = getVideoContainerFromProgressBar(bar);
			if (container && !watchedElements.has(container)) {
				watchedElements.add(container);
				statusMap.set(container, 'watched');
				applyState(container, 'watched');
				// Mark as processed so we don't re-process it
				container.classList.add('YT-HRV-PROCESSED');
			}
		}
	};

	// Process all videos on the page
	const processVideos = async () => {
		// First, process watched videos (instant, no API)
		processWatchedVideos();

		// Then find unprocessed videos to check rating
		const videos = findVideoElements();
		if (videos.length === 0) return;

		// Filter out already-watched videos
		const videosToCheck = videos.filter(({ element }) => !watchedElements.has(element));

		if (videosToCheck.length === 0) return;

		// Build a map from videoId to element for quick lookup
		const videoIdToElement = new Map();
		videosToCheck.forEach(({ element, videoId }) => {
			videoIdToElement.set(videoId, element);
		});

		// Mark as processed and show loading indicator
		videosToCheck.forEach(({ element }) => {
			element.classList.add('YT-HRV-PROCESSED');
			element.classList.add('YT-HRV-LOADING');
		});

		// Check rating status for non-watched videos
		const videoIds = videosToCheck.map(v => v.videoId);
		await checkVideosRatingBatch(videoIds, (videoId, rating) => {
			const element = videoIdToElement.get(videoId);
			if (element) {
				statusMap.set(element, rating);
				applyState(element, rating);
				createThumbButtons(element, videoId, rating);
			}
		});

		// Also add buttons to videos that weren't rated (rating = false)
		videosToCheck.forEach(({ element, videoId }) => {
			if (!statusMap.has(element)) {
				statusMap.set(element, false);
			}
			createThumbButtons(element, videoId, statusMap.get(element));
		});
	};

	// Re-apply state to all processed elements (when state changes)
	const reapplyAllStates = () => {
		statusMap.forEach((status, element) => {
			applyState(element, status);
		});
	};

	// Icons (eye icons for toggle button)
	const ICONS = {
		// Normal - show all videos (eye icon)
		normal: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 48 48"><path fill="currentColor" d="M24 9C14 9 5.46 15.22 2 24c3.46 8.78 12 15 22 15 10.01 0 18.54-6.22 22-15-3.46-8.78-11.99-15-22-15zm0 25c-5.52 0-10-4.48-10-10s4.48-10 10-10 10 4.48 10 10-4.48 10-10 10zm0-16c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6z"/></svg>',
		// Dimmed - dim watched/rated videos (eye with opacity)
		dimmed: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 48 48"><path fill="currentColor" opacity="0.5" d="M24 9C14 9 5.46 15.22 2 24c3.46 8.78 12 15 22 15 10.01 0 18.54-6.22 22-15-3.46-8.78-11.99-15-22-15zm0 25c-5.52 0-10-4.48-10-10s4.48-10 10-10 10 4.48 10 10-4.48 10-10 10zm0-16c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6z"/></svg>',
		// Hidden - hide watched/rated videos (eye with slash)
		hidden: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 48 48"><path fill="currentColor" d="M24 14c5.52 0 10 4.48 10 10 0 1.29-.26 2.52-.71 3.65l5.85 5.85c3.02-2.52 5.4-5.78 6.87-9.5-3.47-8.78-12-15-22.01-15-2.8 0-5.48.5-7.97 1.4l4.32 4.31c1.13-.44 2.36-.71 3.65-.71zM4 8.55l4.56 4.56.91.91C6.17 16.6 3.56 20.03 2 24c3.46 8.78 12 15 22 15 3.1 0 6.06-.6 8.77-1.69l.85.85L39.45 44 42 41.46 6.55 6 4 8.55zM15.06 19.6l3.09 3.09c-.09.43-.15.86-.15 1.31 0 3.31 2.69 6 6 6 .45 0 .88-.06 1.3-.15l3.09 3.09C27.06 33.6 25.58 34 24 34c-5.52 0-10-4.48-10-10 0-1.58.4-3.06 1.06-4.4zm8.61-1.57 6.3 6.3L30 24c0-3.31-2.69-6-6-6l-.33.03z"/></svg>',
	};

	// Thumb icons for like/dislike buttons
	const THUMB_ICONS = {
		like: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M18.77,11h-4.23l1.52-4.94C16.38,5.03,15.54,4,14.38,4c-0.58,0-1.14,0.24-1.52,0.65L7,11H3v10h4h1h9.43 c1.06,0,1.98-0.67,2.19-1.61l1.34-6C21.23,12.15,20.18,11,18.77,11z M7,20H4v-8h3V20z M19.98,13.17l-1.34,6 C18.54,19.65,18.03,20,17.43,20H8v-8.61l5.6-6.06C13.79,5.12,14.08,5,14.38,5c0.26,0,0.5,0.11,0.63,0.3 c0.07,0.1,0.15,0.26,0.09,0.47l-1.52,4.94L13.18,12h1.35h4.23c0.41,0,0.8,0.17,1.03,0.46C19.92,12.61,20.05,12.86,19.98,13.17z"/></svg>',
		likeFilled: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M3,11h3v10H3V11z M18.77,11h-4.23l1.52-4.94C16.38,5.03,15.54,4,14.38,4c-0.58,0-1.14,0.24-1.52,0.65L7,11v10h10.43 c1.06,0,1.98-0.67,2.19-1.61l1.34-6C21.23,12.15,20.18,11,18.77,11z"/></svg>',
		dislike: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M17,4h-1H6.57C5.5,4,4.59,4.67,4.38,5.61l-1.34,6C2.77,12.85,3.82,14,5.23,14h4.23l-1.52,4.94C7.62,19.97,8.46,21,9.62,21 c0.58,0,1.14-0.24,1.52-0.65L17,14h4V4H17z M10.4,19.67C10.21,19.88,9.92,20,9.62,20c-0.26,0-0.5-0.11-0.63-0.3 c-0.07-0.1-0.15-0.26-0.09-0.47l1.52-4.94l0.4-1.29H9.46H5.23c-0.41,0-0.8-0.17-1.03-0.46c-0.12-0.15-0.25-0.4-0.18-0.71l1.34-6 C5.46,5.35,5.97,5,6.57,5H16v8.61L10.4,19.67z M20,13h-3V5h3V13z"/></svg>',
		dislikeFilled: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M18,4h3v10h-3V4z M5.23,14h4.23l-1.52,4.94C7.62,19.97,8.46,21,9.62,21c0.58,0,1.14-0.24,1.52-0.65L17,14V4H6.57 C5.5,4,4.59,4.67,4.38,5.61l-1.34,6C2.77,12.85,3.82,14,5.23,14z"/></svg>',
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
		button.title = `Toggle watched/rated videos: currently "${state}"`;

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
