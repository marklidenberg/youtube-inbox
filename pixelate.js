// ==UserScript==
// @name         YouTube - Pixelate + Grayscale thumbnails (Videos + Shorts)
// @namespace    local
// @version      1.3
// @description  Makes YouTube video + Shorts thumbnails grayscale and very pixelated (handles dynamic loading)
// @match        https://www.youtube.com/*
// @match        https://m.youtube.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(() => {
    'use strict';
  
    // ---- TWEAK THESE ----
    const PIXEL_SCALE = 0.15;      // smaller = chunkier pixels (try 0.04 .. 0.10)
    const JPEG_QUALITY = 0.25;     // lower = more artifacts (0.15 .. 0.40)
    const ONLY_YTIMG = false;       // only pixelate i.ytimg.com thumbs (safer)
    // ---------------------
  
    const THUMB_IMG_SELECTOR = [
      // Shorts (view-model DOM like you pasted)
      'a[href^="/shorts/"] img',
      'a.reel-item-endpoint img',
      'ytm-shorts-lockup-view-model-v2 img',
      'ytm-shorts-lockup-view-model img',
      'yt-thumbnail-view-model img',
      '.ytThumbnailViewModelImage img',

      // Classic thumbnails
      'ytd-thumbnail img',
      'a#thumbnail img',

      // Channel banners and avatars
      'yt-image-banner-view-model img',
      '.yt-spec-avatar-shape img',

      // Common YouTube image classes (your snippet uses ytCoreImageHost)
      'img.ytCoreImageHost',
      'img[class*="ytCoreImage"]',

      // Fallback (most thumbnails)
      'img[src*="i.ytimg.com/vi/"]',
    ].join(', ');
  
    // Grayscale via CSS (cheap + immediate)
    const STYLE = `
      ${THUMB_IMG_SELECTOR} {
        filter: grayscale(100%) !important;
      }
    `;
  
    function injectStyle(cssText) {
      if (document.getElementById('yt-pixel-gray-style')) return;
      const style = document.createElement('style');
      style.id = 'yt-pixel-gray-style';
      style.textContent = cssText;
      (document.head || document.documentElement).appendChild(style);
    }
  
    function getBestSrc(img) {
      return img.currentSrc || img.src || '';
    }
  
    function looksLikeThumb(src) {
      if (!src) return false;
      if (ONLY_YTIMG && !src.includes('i.ytimg.com')) return false;
      // Covers /vi/... plus the oar*.jpg style shorts thumbs, and channel banners/avatars
      return /i\.ytimg\.com\/(vi|vi_|sb)\/|i\.ytimg\.com\/vi\/|\/oar\d*\.jpg|yt3\.googleusercontent\.com\//i.test(src);
    }
  
    async function pixelateImgElement(img) {
      if (!img || img.dataset.ytPixelated === '1') return;
  
      const src = getBestSrc(img);
      if (!looksLikeThumb(src)) return;
  
      // Wait until we have dimensions
      if (!img.complete || !img.naturalWidth || !img.naturalHeight) return;
  
      img.dataset.ytPixelated = '1';
  
      // Build a fresh Image with CORS enabled so canvas export works (if allowed by server)
      const i = new Image();
      i.crossOrigin = 'anonymous';
      // Avoid leaking referrer (sometimes helps with CORS/CDN behavior)
      i.referrerPolicy = 'no-referrer';
  
      const loadPromise = new Promise((resolve, reject) => {
        i.onload = resolve;
        i.onerror = reject;
      });
  
      // Use the best current src (not necessarily img.src if srcset is used)
      i.src = src;
  
      try {
        await loadPromise;
  
        const w = i.naturalWidth || img.naturalWidth;
        const h = i.naturalHeight || img.naturalHeight;
  
        // Step 1: shrink into tiny canvas
        const sw = Math.max(8, Math.round(w * PIXEL_SCALE));
        const sh = Math.max(8, Math.round(h * PIXEL_SCALE));
  
        const small = document.createElement('canvas');
        small.width = sw;
        small.height = sh;
        const sctx = small.getContext('2d', { willReadFrequently: false });
        sctx.imageSmoothingEnabled = true;
        sctx.drawImage(i, 0, 0, sw, sh);
  
        // Step 2: scale it back up without smoothing (this creates pixel blocks)
        const out = document.createElement('canvas');
        out.width = w;
        out.height = h;
        const octx = out.getContext('2d', { willReadFrequently: false });
        octx.imageSmoothingEnabled = false;
        octx.drawImage(small, 0, 0, sw, sh, 0, 0, w, h);
  
        // Export low-quality JPEG for extra crunch
        const dataUrl = out.toDataURL('image/jpeg', JPEG_QUALITY);
  
        // Preserve original so you can revert in devtools if needed
        if (!img.dataset.ytOrigSrc) img.dataset.ytOrigSrc = src;
  
        // Replace the displayed image
        img.src = dataUrl;
        // Some YT images use srcset/currentSrc; disabling srcset avoids it snapping back
        img.removeAttribute('srcset');
      } catch (e) {
        // Most common failure is canvas being "tainted" due to CORS.
        // In that case you’ll still at least get grayscale from CSS.
        img.dataset.ytPixelated = '0';
      }
    }
  
    // Batch processing for performance
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
            // Try now; if not ready, it’ll get picked up again by mutations/load
            pixelateImgElement(img);
          }
        });
      }
    }
  
    function hookLoads(root = document) {
      // Catch late-loading thumbs (lazy images)
      root.addEventListener?.('load', (ev) => {
        const t = ev.target;
        if (t && t.tagName === 'IMG' && t.matches(THUMB_IMG_SELECTOR)) {
          pixelateImgElement(t);
        }
      }, true);
    }
  
    injectStyle(STYLE);
  
    const onReady = () => {
      hookLoads(document);
      queueProcess(document);
  
      const mo = new MutationObserver((mutations) => {
        for (const m of mutations) {
          // Handle newly added nodes
          for (const node of m.addedNodes) {
            if (node && node.nodeType === 1) {
              queueProcess(node);
            }
          }
          // Handle src attribute changes (tab switches reuse DOM, just change src)
          if (m.type === 'attributes' && m.attributeName === 'src') {
            const img = m.target;
            if (img && img.tagName === 'IMG' && img.matches(THUMB_IMG_SELECTOR)) {
              // Reset pixelated flag so it gets reprocessed
              img.dataset.ytPixelated = '0';
              pixelateImgElement(img);
            }
          }
        }
      });

      mo.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
    };
  
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', onReady, { once: true });
    } else {
      onReady();
    }
  })();
  