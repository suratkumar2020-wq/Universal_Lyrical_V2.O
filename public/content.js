// public/content.js - Universal Lyrics Pro — Turbo Edition
// Uses high-resolution timeupdate events (zero polling for YouTube/JioSaavn),
// with a 250ms heartbeat only for Spotify (DOM-only platform).
(function () {
  // ─── State ───────────────────────────────────────────────────────────────
  let lastTrackKey = null;
  let lastSentTime = -1;
  let storageTick = 0;
  let heartbeatId = null;

  // Cache DOM refs so we don't query the DOM on every tick
  const domCache = {
    spotifyTitle: null,
    spotifyArtist: null,
    spotifyTimeEl: null,
    spotifyPlayBtn: null,
    video: null,
    audio: null,
  };
  let domCacheStale = true; // invalidated when track changes

  // ─── Helpers ─────────────────────────────────────────────────────────────
  function detectPlatform() {
    const h = window.location.hostname;
    if (h.includes('spotify')) return 'spotify';
    if (h.includes('youtube')) return 'youtube';
    if (h.includes('jiosaavn')) return 'jiosaavn';
    return 'unknown';
  }

  const platform = detectPlatform();

  function parseTime(str) {
    if (!str) return 0;
    const p = str.trim().split(':').map(Number);
    if (p.length === 2) return (p[0] || 0) * 60 + (p[1] || 0);
    if (p.length === 3) return (p[0] || 0) * 3600 + (p[1] || 0) * 60 + (p[2] || 0);
    return 0;
  }

  function refreshDomCache() {
    if (platform === 'spotify') {
      domCache.spotifyTitle =
        document.querySelector('[data-testid="context-item-info-title"]') ||
        document.querySelector('[data-testid="track-info-name"]');
      domCache.spotifyArtist =
        document.querySelector('[data-testid="context-item-info-artist"]') ||
        document.querySelector('[data-testid="track-info-artists"]');
      domCache.spotifyTimeEl = document.querySelector('[data-testid="playback-position"]');
      domCache.spotifyPlayBtn = document.querySelector('[data-testid="control-button-playpause"]');
    } else if (platform === 'youtube') {
      domCache.video = document.querySelector('video');
    } else if (platform === 'jiosaavn') {
      domCache.audio = document.querySelector('audio');
    }
    domCacheStale = false;
  }

  // ─── Core: gather current media state ────────────────────────────────────
  function getMediaInfo() {
    if (domCacheStale) refreshDomCache();

    const meta = navigator.mediaSession?.metadata;
    let song = meta?.title?.trim() || '';
    let artist = meta?.artist?.trim() || '';
    let currentTime = 0;
    let isPlaying = false;

    if (platform === 'spotify') {
      if (!song && domCache.spotifyTitle) song = domCache.spotifyTitle.textContent?.trim() || '';
      if (!artist && domCache.spotifyArtist) artist = domCache.spotifyArtist.textContent?.trim() || '';
      if (domCache.spotifyTimeEl) currentTime = parseTime(domCache.spotifyTimeEl.textContent);
      if (domCache.spotifyPlayBtn) {
        const label = domCache.spotifyPlayBtn.getAttribute('aria-label') || '';
        isPlaying = label.toLowerCase().includes('pause');
      }
    } else if (platform === 'youtube') {
      // Re-query video only if not found yet (SPA navigation)
      if (!domCache.video) domCache.video = document.querySelector('video');
      const video = domCache.video;
      if (video) {
        currentTime = video.currentTime || 0;
        isPlaying = !video.paused;
      }
      if (!song) {
        const ytMusic = document.querySelector('ytmusic-player-bar .title');
        if (ytMusic) song = ytMusic.textContent?.trim() || '';
      }
      if (!song) {
        const ytTitle = document.querySelector('#title h1 yt-formatted-string, h1.ytd-watch-metadata');
        if (ytTitle) song = ytTitle.textContent?.trim() || '';
      }
      if (!artist) {
        const ytArtist = document.querySelector('ytmusic-player-bar .byline');
        if (ytArtist) artist = ytArtist.textContent?.trim() || '';
      }
    } else if (platform === 'jiosaavn') {
      if (!domCache.audio) domCache.audio = document.querySelector('audio');
      const audio = domCache.audio;
      if (audio) {
        currentTime = audio.currentTime || 0;
        isPlaying = !audio.paused;
      }
    }

    return { song, artist, currentTime, isPlaying };
  }

  // ─── Core: send update to popup ──────────────────────────────────────────
  function sendTick(info, force) {
    if (!info.song) return;
    if (!chrome.runtime?.id) return;

    const trackKey = `${platform}:${info.artist}:${info.song}`;
    const trackChanged = trackKey !== lastTrackKey;

    if (trackChanged) {
      lastTrackKey = trackKey;
      domCacheStale = true; // re-query DOM elements for new track
      chrome.storage.local.set({
        currentTrack: { song: info.song, artist: info.artist, platform, timestamp: Date.now() }
      });
    }

    // Only send if time moved meaningfully (≥0.5s) or track changed or forced
    const timeDiff = Math.abs(info.currentTime - lastSentTime);
    if (!trackChanged && !force && timeDiff < 0.5) return;

    lastSentTime = info.currentTime;

    try {
      const result = chrome.runtime.sendMessage({
        type: 'PLAYBACK_TICK',
        currentTime: info.currentTime,
        isPlaying: info.isPlaying,
        platform,
        song: info.song,
        artist: info.artist,
      });
      if (result?.catch) result.catch(() => {});
    } catch (e) {
      if (e?.message && !String(e.message).includes('Receiving end does not exist')) throw e;
    }

    // Persist playback time: every 3 seconds or on track change
    storageTick++;
    if (storageTick % 6 === 0 || trackChanged) {
      chrome.storage.local.set({ currentPlaybackTime: info.currentTime });
    }
  }

  // ─── Event-driven path: YouTube & JioSaavn ───────────────────────────────
  // Hook into the <video>/<audio> timeupdate event for sub-100ms precision.
  function attachMediaEvents() {
    const el = platform === 'youtube'
      ? document.querySelector('video')
      : platform === 'jiosaavn'
        ? document.querySelector('audio')
        : null;
    if (!el || el.__lyricsHooked) return;
    el.__lyricsHooked = true;

    if (platform === 'youtube') domCache.video = el;
    if (platform === 'jiosaavn') domCache.audio = el;

    el.addEventListener('timeupdate', () => {
      if (!chrome.runtime?.id) return;
      try { sendTick(getMediaInfo(), false); } catch { /* ignore */ }
    }, { passive: true });

    el.addEventListener('play', () => {
      try { sendTick(getMediaInfo(), true); } catch { /* ignore */ }
    }, { passive: true });

    el.addEventListener('pause', () => {
      try { sendTick(getMediaInfo(), true); } catch { /* ignore */ }
    }, { passive: true });

    el.addEventListener('emptied', () => {
      // Track ended / navigated away — detach so we re-hook the new element
      el.__lyricsHooked = false;
      domCache.video = null;
      domCache.audio = null;
    }, { passive: true });
  }

  // For YouTube/JioSaavn: try to hook now, and periodically retry until found
  // (SPA pages load the player element after navigation).
  if (platform === 'youtube' || platform === 'jiosaavn') {
    attachMediaEvents();
    const hookRetry = setInterval(() => {
      if (!chrome.runtime?.id) { clearInterval(hookRetry); return; }
      attachMediaEvents();
    }, 1000); // cheap: just checks for the element, no DOM thrashing
  }

  // ─── Heartbeat: Spotify (DOM-only, no media events available) ───────────
  // Also serves as a fallback "watchdog" for YouTube/JioSaavn track changes.
  heartbeatId = setInterval(() => {
    if (!chrome.runtime?.id) { clearInterval(heartbeatId); return; }
    try {
      const info = getMediaInfo();
      // For Spotify: full tick. For others: only check track change (time handled by events).
      if (platform === 'spotify') {
        sendTick(info, false);
      } else {
        // Just update track metadata if changed (time sync is event-driven)
        if (info.song) {
          const key = `${platform}:${info.artist}:${info.song}`;
          if (key !== lastTrackKey) sendTick(info, true);
        }
      }
    } catch { /* ignore */ }
  }, platform === 'spotify' ? 250 : 2000);

})();