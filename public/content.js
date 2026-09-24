// public/content.js - Universal Lyrics Pro Smart Music Watcher
(function () {
  let lastTrackId = null;
  let lastReportedTime = -1;
  let storageSaveTimer = 0;

  function detectPlatform() {
    const host = window.location.hostname;
    if (host.includes('spotify')) return 'spotify';
    if (host.includes('youtube')) return 'youtube';
    if (host.includes('jiosaavn')) return 'jiosaavn';
    return 'unknown';
  }

  function parseTime(timeStr) {
    if (!timeStr) return 0;
    const parts = timeStr.trim().split(':').map(p => parseInt(p, 10));
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      return parts[0] * 60 + parts[1];
    }
    if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    return 0;
  }

  function getMediaInfo() {
    const platform = detectPlatform();
    let song = '';
    let artist = '';
    let currentTime = 0;
    let isPlaying = false;

    // 1. Try MediaSession
    const meta = navigator.mediaSession?.metadata;
    if (meta?.title) {
      song = meta.title.trim();
      artist = meta.artist?.trim() || '';
    }

    if (platform === 'spotify') {
      // DOM Fallback for track info
      if (!song) {
        const titleEl = document.querySelector('[data-testid="context-item-info-title"]') ||
                        document.querySelector('[data-testid="track-info-name"]');
        const artistEl = document.querySelector('[data-testid="context-item-info-artist"]') ||
                         document.querySelector('[data-testid="track-info-artists"]');
        if (titleEl?.textContent) song = titleEl.textContent.trim();
        if (artistEl?.textContent) artist = artistEl.textContent.trim();
      }

      // Check Spotify Playback Time
      const timeEl = document.querySelector('[data-testid="playback-position"]');
      if (timeEl?.textContent) {
        currentTime = parseTime(timeEl.textContent);
      }

      // Check isPlaying
      const playBtn = document.querySelector('[data-testid="control-button-playpause"]');
      if (playBtn) {
        const label = playBtn.getAttribute('aria-label') || '';
        isPlaying = label.toLowerCase().includes('pause'); // If button says "Pause", music is playing
      }
    } else if (platform === 'youtube') {
      const video = document.querySelector('video');
      if (video) {
        currentTime = video.currentTime || 0;
        isPlaying = !video.paused;
      }

      // Fallback for YouTube Music
      if (!song) {
        const ytMusicTitle = document.querySelector('ytmusic-player-bar .title');
        const ytMusicArtist = document.querySelector('ytmusic-player-bar .byline');
        if (ytMusicTitle?.textContent) song = ytMusicTitle.textContent.trim();
        if (ytMusicArtist?.textContent) artist = ytMusicArtist.textContent.trim();
      }

      // Standard YouTube fallback
      if (!song) {
        const ytTitle = document.querySelector('#title h1 yt-formatted-string, h1.ytd-watch-metadata');
        if (ytTitle?.textContent) {
          song = ytTitle.textContent.trim();
        }
      }
    } else if (platform === 'jiosaavn') {
      const audio = document.querySelector('audio');
      if (audio) {
        currentTime = audio.currentTime || 0;
        isPlaying = !audio.paused;
      }
    }

    return { song, artist, platform, currentTime, isPlaying };
  }

  const pollInterval = setInterval(() => {
    // Check if extension context is still valid
    if (!chrome.runtime?.id) {
      clearInterval(pollInterval);
      return;
    }

    try {
      const info = getMediaInfo();
      if (!info.song) return;

      const trackKey = `${info.platform}:${info.artist}:${info.song}`;
      const trackChanged = trackKey !== lastTrackId;

      if (trackChanged) {
        lastTrackId = trackKey;
        const currentTrack = {
          song: info.song,
          artist: info.artist,
          platform: info.platform,
          timestamp: Date.now()
        };
        chrome.storage.local.set({ currentTrack });
      }

      // Send live playback tick via lightweight runtime message
      const timeDiff = Math.abs(info.currentTime - lastReportedTime);
      if (timeDiff >= 0.25 || trackChanged) {
        lastReportedTime = info.currentTime;
        chrome.runtime.sendMessage({
          type: 'PLAYBACK_TICK',
          currentTime: info.currentTime,
          isPlaying: info.isPlaying,
          platform: info.platform,
          song: info.song,
          artist: info.artist,
          timestamp: Date.now()
        }).catch(() => {}); // Popup closed, safe to ignore

        // Persist to storage only once every 3 seconds to avoid disk thrashing
        storageSaveTimer++;
        if (storageSaveTimer % 6 === 0 || trackChanged) {
          chrome.storage.local.set({ currentPlaybackTime: info.currentTime });
        }
      }
    } catch {
      // Ignore extension reload edge cases
    }
  }, 500);
})();