import { lazy, Suspense, useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { FormEvent } from 'react';
import { db } from './firebaseConfig';
import { doc, getDoc } from 'firebase/firestore/lite';

declare const chrome: any;
import {
  MoreVertical, Heart, Home, Settings, Flag, RefreshCw, Cpu,
  ExternalLink, Search, Copy, Check, Sparkles, X, ChevronDown, Pin, PinOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const AdminPanel = lazy(() => import('./Admin'));

interface LyricLine {
  id: number;
  time: number;
  original: string;
  translated?: string;
}

type Platform = 'spotify' | 'youtube' | 'jiosaavn';

const THEMES: Record<Platform, { color: string; bg: string; secondary: string; glow: string }> = {
  spotify: { color: '#1db954', bg: '#080808', secondary: '#1ed760', glow: 'rgba(29, 185, 84, 0.25)' },
  youtube: { color: '#ff0000', bg: '#0a0505', secondary: '#ff4d4d', glow: 'rgba(255, 0, 0, 0.25)' },
  jiosaavn: { color: '#0fb3b8', bg: '#020d0e', secondary: '#73f6fb', glow: 'rgba(15, 179, 184, 0.25)' }
};

const GlowBeat = ({ color, isPlaying }: { color: string; isPlaying: boolean }) => (
  <div className="flex items-end gap-[3px] h-6 px-1">
    {[1, 2, 3, 4].map((i) => (
      <div
        key={i}
        className={`w-[3.5px] rounded-full transition-all duration-300 ${isPlaying ? `animate-beat-${i}` : 'h-1.5 opacity-40'}`}
        style={{
          backgroundColor: color,
          boxShadow: isPlaying ? `0 0 10px ${color}` : 'none'
        }}
      />
    ))}
  </div>
);

/* Living beat-reactive background — transparent layers behind lyrics.
   - Drifting orbs + aurora breathe continuously (faster/brighter on play)
   - Central pulse kicks on every beat tick (active lyric line + tempo clock)
   - Bottom spectrum + rising particles dance only while isPlaying
   All low-opacity + blurred so lyrics stay fully readable. */
const BeatBackground = ({
  color, glow, secondary, isPlaying, beatPulse,
}: { color: string; glow: string; secondary: string; isPlaying: boolean; beatPulse: number }) => {
  const particles = useMemo(() => (
    Array.from({ length: 12 }).map((_, i) => ({
      left: `${(i * 83 + 7) % 100}%`,
      size: 2 + ((i * 7) % 4),
      delay: `${(i * 0.9) % 6}s`,
      duration: `${5 + ((i * 13) % 5)}s`,
    }))
  ), []);

  const bars = useMemo(() => (
    Array.from({ length: 28 }).map((_, i) => ({
      delay: `${(i % 7) * 0.09}s`,
      duration: `${0.5 + ((i * 17) % 40) / 100}s`,
      height: 18 + ((i * 29) % 42),
    }))
  ), []);

  return (
    <div className={`absolute inset-0 z-0 overflow-hidden pointer-events-none ${isPlaying ? '' : 'bg-paused'}`}>
      {/* Drifting transparent orbs — theme tinted */}
      <div
        className="bg-orb-a seamless-theme-glow absolute -top-16 -left-20 w-72 h-72 rounded-full blur-[80px] opacity-25"
        style={{ backgroundColor: color }}
      />
      <div
        className="bg-orb-b seamless-theme-glow absolute top-1/3 -right-24 w-80 h-80 rounded-full blur-[90px] opacity-20"
        style={{ backgroundColor: secondary }}
      />
      <div
        className="bg-orb-a seamless-theme-glow absolute bottom-10 -left-16 w-64 h-64 rounded-full blur-[70px] opacity-[0.14]"
        style={{ backgroundColor: color, animationDelay: '-6s' }}
      />

      {/* Aurora ribbons — ultra transparent diagonal wash */}
      <div
        className="bg-aurora absolute top-1/4 -left-1/4 w-[150%] h-24 blur-[50px] opacity-20"
        style={{ background: `linear-gradient(90deg, transparent, ${glow}, transparent)` }}
      />
      <div
        className="bg-aurora absolute top-1/2 -left-1/4 w-[150%] h-16 blur-[40px] opacity-[0.12]"
        style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)`, animationDelay: '-4.5s' }}
      />

      {/* Beat kick pulse — scales on every beat tick while playing */}
      <motion.div
        key={isPlaying ? beatPulse : 'paused'}
        initial={{ scale: 0.9, opacity: 0.1 }}
        animate={isPlaying
          ? { scale: [0.9, 1.18, 1], opacity: [0.12, 0.32, 0.16] }
          : { scale: 1, opacity: 0.1 }}
        transition={isPlaying ? { duration: 0.55, ease: 'easeOut' } : { duration: 0.6 }}
        className="absolute left-1/2 top-[38%] -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full blur-[60px]"
        style={{ background: `radial-gradient(circle, ${glow} 0%, transparent 70%)` }}
      />

      {/* Rising particles — float up only while playing */}
      {isPlaying && particles.map((p, i) => (
        <span
          key={i}
          className="bg-particle absolute bottom-16 rounded-full"
          style={{
            left: p.left,
            width: p.size,
            height: p.size,
            backgroundColor: color,
            boxShadow: `0 0 8px ${color}`,
            animation: `particleRise ${p.duration} linear ${p.delay} infinite`,
          }}
        />
      ))}

      {/* Bottom spectrum — transparent bars bouncing to the beat */}
      <div className="absolute inset-x-0 bottom-0 h-[74px] flex items-end justify-center gap-[5px] px-6 opacity-40">
        {bars.map((b, i) => (
          <span
            key={i}
            className="bg-spectrum-bar w-[3px] rounded-full origin-bottom"
            style={{
              height: b.height,
              background: `linear-gradient(to top, ${color}, ${secondary})`,
              boxShadow: isPlaying ? `0 0 8px ${glow}` : 'none',
              opacity: isPlaying ? undefined : 0.15,
              animation: isPlaying ? `spectrumBounce ${b.duration} ease-in-out ${b.delay} infinite` : 'none',
              transform: isPlaying ? undefined : 'scaleY(0.2)',
            }}
          />
        ))}
        <div
          className="absolute inset-x-0 bottom-0 h-[74px] pointer-events-none"
          style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.55), transparent)' }}
        />
      </div>

      {/* Vignette keeps lyrics readable over all motion */}
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,0.5) 100%)' }} />
    </div>
  );
};

export default function App() {
  const [platform, setPlatform] = useState<Platform>('spotify');
  const [song, setSong] = useState('');
  const [artist, setArtist] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isHinglish, setIsHinglish] = useState(true);
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  const [activeTab, setActiveTab] = useState<'home' | 'settings' | 'report' | 'admin'>('home');
  const [showMenu, setShowMenu] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchSong, setSearchSong] = useState('');
  const [searchArtist, setSearchArtist] = useState('');
  const [copied, setCopied] = useState(false);
  const [userScrolled, setUserScrolled] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  // windowId of this floating window (set once, used to toggle alwaysOnTop)
  const windowIdRef = useRef<number | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<any>(null);
  const scrollRafRef = useRef<number>(0);
  // Refs to hold latest song/artist without causing effect re-registration
  const songRef = useRef(song);
  const artistRef = useRef(artist);
  // Ref for currentTime so the message handler never triggers a render for
  // sub-0.5s deltas (we batch updates and only setState when meaningful)
  const currentTimeRef = useRef(0);
  const pendingTimeRef = useRef<number | null>(null);
  const timeFlushId = useRef<any>(null);
  useEffect(() => { songRef.current = song; }, [song]);
  useEffect(() => { artistRef.current = artist; }, [artist]);

  const theme = THEMES[platform] || THEMES.spotify;
  const isWindow = typeof window !== 'undefined' && window.location.search.includes('window=true');

  // Beat clock: extension has no raw audio feed, so we synthesize a musical
  // pulse — ~110 BPM interval while playing, re-triggered on lyric change.
  // BeatBackground uses this to kick its glow + spectrum like a visualizer.
  const [beatPulse, setBeatPulse] = useState(0);
  useEffect(() => {
    if (!isPlaying) return;
    const id = setInterval(() => setBeatPulse((v) => v + 1), 545);
    return () => clearInterval(id);
  }, [isPlaying, song]);

  // Professional native titlebar: keep it short like Spotify.
  // Native OS chrome can't be made frameless from an extension,
  // so we sync it: "Song — Artist" while playing, app name when idle,
  // plus <meta name="theme-color"> so supporting shells tint to match.
  useEffect(() => {
    try {
      const base = 'Universal Lyrics Pro';
      document.title = song ? `${song}${artist ? ` — ${artist}` : ''}` : base;
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', theme.bg);
    } catch { /* ignore */ }
  }, [song, artist, theme.bg]);

  // Helper to parse LRC string into LyricLine array
  const parseAndSetLRC = useCallback((lrcString: string): LyricLine[] => {
    return lrcString
      .split('\n')
      .map((line, i) => {
        const match = line.match(/^\[(\d{2}):(\d{2}(?:\.\d+)?)\]\s*(.*)/);
        if (match) {
          return {
            id: i,
            time: parseInt(match[1], 10) * 60 + parseFloat(match[2]),
            original: match[3]?.trim() || "♪",
            translated: ""
          };
        }
        return null;
      })
      .filter(Boolean) as LyricLine[];
  }, []);

  const fetchLyrics = useCallback(async (targetSong?: string, targetArtist?: string) => {
    // Always read latest from refs so this callback never needs song/artist in deps
    const resolvedSong = targetSong ?? songRef.current;
    const resolvedArtist = targetArtist ?? artistRef.current;
    if (!resolvedSong) return;
    setIsLoading(true);
    setLyrics([]);

    try {
      // 1. PRIORITY 1: Check Firebase Verified DB (1.5s timeout — fast fail)
      const songId = `${resolvedArtist.toLowerCase().trim().replace(/ /g, '_')}_${resolvedSong.toLowerCase().trim().replace(/ /g, '_')}`;
      try {
        const docRef = doc(db, "verified_lyrics", songId);
        const firebaseTimeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500));
        const docSnapResult = await Promise.race([getDoc(docRef), firebaseTimeout]);
        const docSnap = docSnapResult;

        if (docSnap && typeof docSnap === 'object' && 'exists' in docSnap && (docSnap as any).exists()) {
          const verifiedData = (docSnap as any).data();
          const originalLines = (verifiedData.lrc || "").split('\n');
          const hinglishLines = (verifiedData.hinglishLrc || "").split('\n');

          const mergedLyrics = originalLines.map((line: string, i: number) => {
            const match = line.match(/^\[(\d{2}):(\d{2}(?:\.\d+)?)\]\s*(.*)/);
            if (match) {
              const time = parseInt(match[1], 10) * 60 + parseFloat(match[2]);
              const originalText = match[3]?.trim() || "♪";

              let transText = "";
              if (hinglishLines[i]) {
                const transMatch = hinglishLines[i].match(/^\[\d{2}:\d{2}(?:\.\d+)?\]\s*(.*)/);
                transText = transMatch ? transMatch[1]?.trim() : hinglishLines[i].replace(/^\[.*?\]\s*/, "").trim();
              }

              return { id: i, time, original: originalText, translated: transText };
            }
            return null;
          }).filter(Boolean) as LyricLine[];

          if (mergedLyrics.length > 0) {
            setLyrics(mergedLyrics);
            setIsLoading(false);
            return;
          }
        } else if (!docSnap) {
          // Firebase timed out — skip silently
        }
      } catch (err) {
        // Firebase query skipped
      }

      // 2. PRIORITY 2: Check LRCLIB directly
      try {
        const lrcUrl = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(resolvedArtist)}&track_name=${encodeURIComponent(resolvedSong)}`;
        const lrcRes = await fetch(lrcUrl);
        if (lrcRes.ok) {
          const lrcData = await lrcRes.json();
          if (lrcData.syncedLyrics) {
            const parsed = parseAndSetLRC(lrcData.syncedLyrics);
            if (parsed.length > 0) {
              setLyrics(parsed);
              setIsLoading(false);
              return;
            }
          }
        }
      } catch {
        // LRCLIB query skipped
      }

      // 3. PRIORITY 3: Cloud Backend (Vercel Serverless / AI Fallback)
      try {
        const backendUrl = `https://newuniversal-lyrics-pro.vercel.app/api/lyrics?song=${encodeURIComponent(resolvedSong)}&artist=${encodeURIComponent(resolvedArtist)}`;
        const res = await fetch(backendUrl);
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'success' && data.data) {
            const rawOriginal = data.data.original || '';
            const hinglishArr = data.data.hinglish ? data.data.hinglish.split('\n') : [];

            const parsedLines = rawOriginal.split('\n').map((line: string, i: number) => {
              const match = line.match(/^\[(\d{2}):(\d{2}(?:\.\d+)?)\]\s*(.*)/);
              let time = -1;
              let text = line.trim();
              if (match) {
                time = parseInt(match[1], 10) * 60 + parseFloat(match[2]);
                text = match[3]?.trim() || "♪";
              }
              let transText = hinglishArr[i] || '';
              const transMatch = transText.match(/^\[\d{2}:\d{2}(?:\.\d+)?\]\s*(.*)/);
              if (transMatch) transText = transMatch[1]?.trim() || '';

              return { id: i, time, original: text || "♪", translated: transText };
            }).filter((l: LyricLine) => l.original.trim() !== '');

            if (parsedLines.length > 0) {
              setLyrics(parsedLines);
              setIsLoading(false);
              return;
            }
          }
        }
      } catch {
        // Backend API query skipped
      }
    } catch {
      // Lyrics fetch error
    } finally {
      setIsLoading(false);
    }
  }, [parseAndSetLRC]); // No song/artist deps — uses refs, so never stale

  // Flush batched currentTime update to React state (called at most once per rAF frame)
  const flushPendingTime = useCallback(() => {
    timeFlushId.current = null;
    if (pendingTimeRef.current !== null) {
      setCurrentTime(pendingTimeRef.current);
      pendingTimeRef.current = null;
    }
  }, []);

  // Extension Message & Storage Sync
  useEffect(() => {
    let handleRuntimeMessage: ((message: any) => void) | null = null;
    let handleStorageChange: ((changes: any, areaName: string) => void) | null = null;
    try {
      const c = (globalThis as any)?.chrome;
      if (!c?.storage?.local || !c?.runtime?.onMessage) return;
      // 1. Initial Storage Fetch
      try {
        c.storage.local.get(['currentTrack', 'currentPlaybackTime'], (result: any) => {
          try {
            if (c?.runtime?.lastError) return; // extension reloaded mid-read
            if (result?.currentTrack) {
              setSong(result.currentTrack.song || '');
              setArtist(result.currentTrack.artist || '');
              if (result.currentTrack.platform) setPlatform(result.currentTrack.platform);
            }
            if (typeof result?.currentPlaybackTime === 'number') {
              currentTimeRef.current = result.currentPlaybackTime;
              setCurrentTime(result.currentPlaybackTime);
            }
          } catch { /* ignore */ }
        });
      } catch { /* storage unavailable (e.g. dev server) */ }

      // 2. Real-Time Message Listener
      // Uses refs so this handler is never stale and never needs re-registration.
      // currentTime updates are BATCHED via rAF to avoid a React render on every
      // timeupdate event (~4 times/sec) — we only re-render when the frame paints.
      handleRuntimeMessage = (message: any) => {
        if (message?.type !== 'PLAYBACK_TICK') return;

        if (typeof message.isPlaying === 'boolean') {
          setIsPlaying(message.isPlaying);
        }

        // Track changed — update immediately
        if (message.song && message.song !== songRef.current) {
          setSong(message.song);
          setArtist(message.artist || '');
          if (message.platform) setPlatform(message.platform);
        }

        // Time update — batch via rAF so we render at most once per display frame
        if (typeof message.currentTime === 'number') {
          currentTimeRef.current = message.currentTime;
          pendingTimeRef.current = message.currentTime;
          if (!timeFlushId.current) {
            timeFlushId.current = requestAnimationFrame(flushPendingTime);
          }
        }
      };

      c.runtime.onMessage.addListener(handleRuntimeMessage);

      // 3. Storage Change Listener (Fallback for when popup was closed)
      handleStorageChange = (changes: any, areaName: string) => {
        if (areaName !== 'local') return;
        if (changes.currentTrack?.newValue) {
          const val = changes.currentTrack.newValue;
          setSong(val.song || '');
          setArtist(val.artist || '');
          if (val.platform) setPlatform(val.platform);
        }
        if (changes.currentPlaybackTime?.newValue !== undefined) {
          const t = changes.currentPlaybackTime.newValue;
          currentTimeRef.current = t;
          pendingTimeRef.current = t;
          if (!timeFlushId.current) {
            timeFlushId.current = requestAnimationFrame(flushPendingTime);
          }
        }
      };
      c.storage.onChanged.addListener(handleStorageChange);

      return () => {
        try {
          if (handleRuntimeMessage) c.runtime.onMessage.removeListener(handleRuntimeMessage);
          if (handleStorageChange) c.storage.onChanged.removeListener(handleStorageChange);
          if (timeFlushId.current) cancelAnimationFrame(timeFlushId.current);
        } catch { /* ignore */ }
      };
    } catch { /* non-extension context (dev server) — run without chrome APIs */ }
    return undefined;
  }, [flushPendingTime]); // stable: flushPendingTime is memoized

  // Auto-fetch on song change
  useEffect(() => {
    if (song) {
      fetchLyrics(song, artist);
    }
  // fetchLyrics is stable (no song/artist dep); song/artist trigger the fetch
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [song, artist]);

  // Calculate current active line
  const activeIndex = useMemo(() => {
    if (!lyrics.length) return 0;
    let idx = 0;
    for (let i = 0; i < lyrics.length; i++) {
      if (lyrics[i].time !== -1 && lyrics[i].time <= currentTime + 0.3) {
        idx = i;
      }
    }
    return idx;
  }, [lyrics, currentTime]);

  // Smooth Jitter-Free Auto Scroll — uses rAF to avoid layout thrashing
  useEffect(() => {
    if (activeTab !== 'home' || userScrolled) return;

    // Cancel any pending scroll frame before scheduling a new one
    if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current);

    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = 0;
      const activeEl = document.getElementById(`lyric-${activeIndex}`);
      const container = scrollRef.current;
      if (!activeEl || !container) return;

      const containerHeight = container.clientHeight;
      const targetTop = activeEl.offsetTop - (containerHeight / 2) + (activeEl.clientHeight / 2);
      const currentScroll = container.scrollTop;
      // Only scroll if the line is more than 80px away from ideal — avoids micro-jitter
      if (Math.abs(currentScroll - Math.max(0, targetTop)) > 80) {
        container.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
      }
    });
  }, [activeIndex, activeTab, userScrolled]);

  // User manual scroll detection — memoized to prevent inline function on each render
  const handleScroll = useCallback(() => {
    setUserScrolled(true);
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      setUserScrolled(false);
    }, 3500);
  }, []);

  const handlePopOut = () => {
    try {
      const c = (globalThis as any)?.chrome;
      if (c?.runtime?.sendMessage) {
        c.runtime.sendMessage({ type: 'OPEN_FLOATING_WINDOW', alwaysOnTop: false });
        window.close();
      }
    } catch { /* ignore */ }
  };

  // Pin = keep window in front of all other windows.
  // From popup  → pop out immediately as a pinned floating window.
  // From floating window → toggle alwaysOnTop via the background worker.
  const handleTogglePin = useCallback(() => {
    try {
      const c = (globalThis as any)?.chrome;
      if (!c?.runtime?.sendMessage) return;

      if (!isWindow) {
        // Not yet a floating window — pop out pinned
        c.runtime.sendMessage({ type: 'OPEN_FLOATING_WINDOW', alwaysOnTop: true }, () => {});
        window.close();
        return;
      }

      const nextPinned = !isPinned;

      // Get our own window ID the first time
      const doToggle = (winId: number) => {
        c.runtime.sendMessage(
          { type: 'SET_ALWAYS_ON_TOP', windowId: winId, enabled: nextPinned },
          (resp: any) => {
            if (resp?.success) setIsPinned(nextPinned);
          }
        );
      };

      if (windowIdRef.current) {
        doToggle(windowIdRef.current);
      } else {
        // Discover our own window ID (chrome.windows.getCurrent)
        if (c.windows?.getCurrent) {
          c.windows.getCurrent((win: any) => {
            if (win?.id) {
              windowIdRef.current = win.id;
              doToggle(win.id);
            }
          });
        }
      }
    } catch { /* ignore */ }
  }, [isWindow, isPinned]);

  // On mount inside a floating window: discover our window ID & sync pin state
  useEffect(() => {
    if (!isWindow) return;
    try {
      const c = (globalThis as any)?.chrome;
      if (!c?.windows?.getCurrent) return;
      c.windows.getCurrent((win: any) => {
        if (win?.id) {
          windowIdRef.current = win.id;
          setIsPinned(!!win.alwaysOnTop);
        }
      });
    } catch { /* ignore */ }
  }, [isWindow]);

  const handleCopyLyrics = () => {
    if (!lyrics.length) return;
    const text = lyrics.map(l => (isHinglish && l.translated ? `${l.translated} (${l.original})` : l.original)).join('\n');
    try {
      navigator.clipboard?.writeText(text)?.catch?.(() => {});
    } catch { /* clipboard unavailable */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleManualSearch = (e: FormEvent) => {
    e.preventDefault();
    if (searchSong.trim()) {
      setSong(searchSong.trim());
      setArtist(searchArtist.trim());
      setShowSearch(false);
    }
  };

  const handleSendReport = () => {
    const formId = "1FAIpQLSfFc0eolMHv5g7nSOzZeIYhT_5WNGkwrtyPUUE_yY1zzDX9gQ";
    const songEntry = "entry.694037124";
    const artistEntry = "entry.1494193670";
    const finalUrl = `https://docs.google.com/forms/d/e/${formId}/viewform?usp=pp_url&${songEntry}=${encodeURIComponent(song)}&${artistEntry}=${encodeURIComponent(artist)}`;
    window.open(finalUrl, '_blank');
  };

  return (
    <div
      className={`flex flex-col text-white font-sans overflow-hidden select-none relative mx-auto min-w-0 max-w-full ${
        isWindow ? 'w-full h-screen min-h-0' : 'w-[400px] h-[600px] min-w-[400px] min-h-[600px] max-w-[400px] max-h-[600px]'
      }`}
      style={{ backgroundColor: theme.bg, transition: 'background-color 0.9s ease' }}
    >
      {/* Living beat background — transparent motion behind lyrics (see BeatBackground).
          Lyrics stay readable via low opacity + blur + vignette. */}
      <BeatBackground
        color={theme.color}
        glow={theme.glow}
        secondary={theme.secondary}
        isPlaying={isPlaying}
        beatPulse={beatPulse + activeIndex}
      />
      {/* Spotify-style seamless top wash (kept above beat bg for edge tint) */}
      <div className="absolute inset-x-0 top-0 h-32 pointer-events-none z-[1] overflow-hidden">
        <div
          className="seamless-theme-glow absolute inset-x-0 top-0 h-24 opacity-25"
          style={{ background: `linear-gradient(to bottom, ${theme.glow}, transparent)` }}
        />
      </div>
      {/* 2px pro hairline directly under the OS titlebar — the "edge bar"
          that follows the music theme with a soft glow + smooth transition.
          Pulses gently with the beat while playing. */}
      <div
        className={`seamless-theme-hairline relative z-50 h-[2px] w-full shrink-0 ${isPlaying ? 'bg-breathe' : ''}`}
        style={{ backgroundColor: theme.color, boxShadow: `0 0 12px ${theme.glow}, 0 1px 8px ${theme.glow}` }}
      />

      {/* Seamless Header — transparent, no bezel/border, drag-to-move in floating window */}
      <header className={`min-h-[52px] pl-4 pr-3 py-2 flex items-center justify-between gap-2 z-50 relative bg-gradient-to-b from-black/50 to-transparent backdrop-blur-md min-w-0 max-w-full ${isWindow ? 'drag-region' : ''}`}>
        <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
          <div className="w-2 h-2 rounded-full animate-pulse shrink-0 seamless-theme-glow" style={{ backgroundColor: theme.color, boxShadow: `0 0 8px ${theme.color}` }} />
          <span className="text-[10px] font-black tracking-[3px] uppercase text-white/70 truncate fluid-title">{platform}</span>
          {isPlaying && (
            <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-white/10 text-white/80 uppercase tracking-widest shrink-0 hidden min-[300px]:inline-block">
              Live
            </span>
          )}
        </div>

        <div className={`flex items-center gap-1.5 min-[360px]:gap-3 text-white/40 shrink-0 ${isWindow ? 'no-drag' : ''}`}>
          <button
            onClick={() => setShowSearch(!showSearch)}
            title="Search song manually"
            className="p-1 hover:text-white transition-colors"
          >
            <Search className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => fetchLyrics()}
            title="Refresh lyrics"
            className={`p-1 hover:text-white transition-all ${isLoading ? 'animate-spin text-white' : ''}`}
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          {!isWindow && (
            <button
              onClick={handlePopOut}
              title="Open floating window"
              className="p-1 hover:text-white transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}

          {/* ── Pin button: keeps this window always-on-top ── */}
          <button
            id="pin-toggle-btn"
            onClick={handleTogglePin}
            title={isPinned ? 'Unpin window' : 'Pin on top of all tabs'}
            className={`p-1 transition-all duration-200 rounded-md relative group ${
              isPinned
                ? 'text-white'
                : 'text-white/40 hover:text-white'
            }`}
            style={isPinned ? {
              color: theme.color,
              filter: `drop-shadow(0 0 6px ${theme.color})`,
            } : {}}
          >
            {isPinned ? (
              <PinOff className="w-3.5 h-3.5" />
            ) : (
              <Pin className="w-3.5 h-3.5" />
            )}
            {/* Active glow ring */}
            {isPinned && (
              <span
                className="absolute inset-0 rounded-md pointer-events-none"
                style={{ boxShadow: `0 0 10px ${theme.glow}`, opacity: 0.5 }}
              />
            )}
          </button>

          <div className="w-[1px] h-3 bg-white/10" />

          <button
            onClick={() => setShowMenu(!showMenu)}
            title="Menu"
            className="p-1 hover:text-white transition-colors relative"
          >
            <MoreVertical className="w-3.5 h-3.5" />
          </button>

          {/* Context Dropdown Menu */}
          <AnimatePresence>
            {showMenu && (
              <motion.div
                initial={{ opacity: 0, scale: 0.92, y: -8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: -8 }}
                transition={{ duration: 0.15 }}
                className="absolute right-3 top-12 w-44 bg-zinc-900/95 backdrop-blur-2xl border border-white/10 rounded-2xl p-2 shadow-2xl z-[120]"
              >
                <button
                  onClick={() => { handleCopyLyrics(); setShowMenu(false); }}
                  className="w-full text-left px-3 py-2 text-[11px] font-bold text-white/80 hover:bg-white/10 rounded-xl transition-colors flex items-center justify-between"
                >
                  <span>Copy All Lyrics</span>
                  {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5 text-white/40" />}
                </button>
                <button
                  onClick={() => { setActiveTab('admin'); setShowMenu(false); }}
                  className="w-full text-left px-3 py-2 text-[11px] font-bold text-amber-400 hover:bg-amber-400/10 rounded-xl transition-colors flex items-center gap-2 border-t border-white/5 mt-1"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Host Editor</span>
                </button>
                <button
                  onClick={() => { window.location.reload(); }}
                  className="w-full text-left px-3 py-2 text-[11px] font-bold text-white/60 hover:bg-white/10 rounded-xl transition-colors"
                >
                  Reload Player
                </button>
                <button
                  onClick={() => setShowMenu(false)}
                  className="w-full text-left px-3 py-2 text-[11px] font-bold text-red-400/80 hover:bg-red-500/10 rounded-xl transition-colors border-t border-white/5 mt-1"
                >
                  Close Menu
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>

      {/* Expandable Search Drawer */}
      <AnimatePresence>
        {showSearch && (
          <motion.form
            onSubmit={handleManualSearch}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-4 py-3 bg-zinc-900/90 backdrop-blur-xl border-b border-white/10 flex flex-col gap-2 z-40 overflow-hidden min-w-0 max-w-full"
          >
            <div className="flex flex-col min-[360px]:flex-row gap-2 min-w-0 max-w-full">
              <input
                type="text"
                placeholder="Song name..."
                value={searchSong}
                onChange={(e) => setSearchSong(e.target.value)}
                className="flex-1 min-w-0 w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-white/40 outline-none focus:border-white/30"
              />
              <input
                type="text"
                placeholder="Artist (optional)..."
                value={searchArtist}
                onChange={(e) => setSearchArtist(e.target.value)}
                className="flex-1 min-w-0 w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-white/40 outline-none focus:border-white/30"
              />
              <button
                type="submit"
                className="px-3 py-2 rounded-xl text-xs font-bold text-black bg-white active:scale-95 transition-transform shrink-0"
              >
                Find
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <main
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto overflow-x-hidden px-4 min-[360px]:px-5 py-4 space-y-3 pb-28 no-scrollbar scroll-smooth relative z-10 min-w-0 max-w-full"
      >
        {activeTab === 'home' ? (
          <>
            {/* Song Header & Beat Glow — fluid: shrinks art, truncates text, never clips */}
            <section className="pt-1 pb-3 flex items-center gap-2.5 min-[360px]:gap-3.5 bg-gradient-to-b from-black/20 to-transparent sticky top-0 z-30 backdrop-blur-sm -mx-4 min-[360px]:-mx-5 px-4 min-[360px]:px-5 min-w-0 max-w-full overflow-hidden">
              <div className="relative group shrink-0">
                <div className="w-11 h-11 min-[360px]:w-[52px] min-[360px]:h-[52px] rounded-2xl overflow-hidden shadow-2xl border border-white/10 relative z-10 bg-zinc-900 flex items-center justify-center shrink-0">
                  <GlowBeat color={theme.color} isPlaying={isPlaying} />
                </div>
                <div
                  className="absolute inset-0 rounded-2xl blur-lg opacity-40 seamless-theme-glow"
                  style={{ backgroundColor: theme.color }}
                />
              </div>

              <div className="flex flex-col min-w-0 flex-1 overflow-hidden">
                <h1
                  title={song || "Universal Lyrics Pro"}
                  className="text-[15px] min-[360px]:text-[17px] font-black text-white truncate tracking-tight min-w-0 max-w-full"
                >
                  {song || "Universal Lyrics Pro"}
                </h1>
                <p
                  title={artist || "Play music on Spotify or YouTube"}
                  className="text-[11px] min-[360px]:text-[12px] font-bold truncate opacity-70 min-w-0 max-w-full"
                  style={{ color: theme.secondary }}
                >
                  {artist || "Play music on Spotify or YouTube"}
                </p>
              </div>

              <button
                onClick={handleCopyLyrics}
                title="Copy lyrics"
                className="p-2 text-white/40 hover:text-white transition-colors shrink-0 -mr-1"
              >
                {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </section>

            {/* Lyrics View */}
            {isLoading ? (
              <div className="flex flex-col items-center justify-center h-64 gap-3 text-white/30">
                <RefreshCw className="w-8 h-8 animate-spin" />
                <p className="text-[11px] font-black tracking-widest uppercase text-center text-white/50 leading-relaxed">
                  Syncing Beats &<br />Fetching Lyrics
                </p>
              </div>
            ) : lyrics.length > 0 ? (
              lyrics.map((line, index) => {
                const status = index === activeIndex ? 'active' : index < activeIndex ? 'passed' : 'future';
                const primaryText = isHinglish ? (line.translated || line.original) : line.original;
                const secondaryText = (isHinglish && line.translated) ? line.original : null;

                return (
                  <div
                    key={line.id}
                    id={`lyric-${index}`}
                    onClick={() => setCurrentTime(line.time > 0 ? line.time : currentTime)}
                    className={`relative p-3.5 min-[360px]:p-4 transition-all duration-300 rounded-[20px] cursor-pointer border min-w-0 max-w-full overflow-hidden ${
                      status === 'active'
                        ? 'bg-white/[0.06] border-white/15 shadow-xl scale-[1.01] min-[360px]:scale-[1.02]'
                        : 'border-transparent hover:bg-white/[0.02]'
                    }`}
                  >
                    <p
                      className={`font-black leading-snug tracking-tight transition-all duration-300 min-w-0 max-w-full break-words whitespace-pre-wrap ${
                        status === 'active'
                          ? 'text-[18px] min-[360px]:text-[21px] text-white'
                          : status === 'passed'
                          ? 'text-[15px] min-[360px]:text-[17px] opacity-35 text-white/70'
                          : 'text-[15px] min-[360px]:text-[17px] opacity-20 text-white/50'
                      }`}
                    >
                      {primaryText}
                    </p>

                    {secondaryText && status === 'active' && (
                      <p className="text-[12px] min-[360px]:text-[13px] font-bold mt-1.5 opacity-80 min-w-0 max-w-full break-words whitespace-pre-wrap" style={{ color: theme.secondary }}>
                        {secondaryText}
                      </p>
                    )}

                    {status === 'active' && (
                      <div
                        className="absolute left-0 top-4 bottom-4 w-1 rounded-full shadow-lg"
                        style={{ backgroundColor: theme.color, boxShadow: `0 0 12px ${theme.color}` }}
                      />
                    )}
                  </div>
                );
              })
            ) : (
              <div className="h-64 flex flex-col items-center justify-center text-center opacity-40 mt-10">
                <Cpu className="w-12 h-12 mb-3 mx-auto" />
                <p className="text-xs font-black tracking-widest uppercase text-white/70">Awaiting Track</p>
                <p className="text-[11px] text-white/40 mt-1">Start playing music or search above</p>
              </div>
            )}
          </>
        ) : activeTab === 'settings' ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="pt-6 space-y-6">
            <h2 className="text-2xl font-black text-white">Settings</h2>
            <div className="space-y-3">
              <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                <p className="text-[9px] font-black text-white/40 uppercase tracking-widest mb-1">Adaptive Color Theme</p>
                <p className="text-xs font-bold text-white/90">
                  Matches platform dynamically (<span style={{ color: theme.color }}>Active: {platform.toUpperCase()}</span>)
                </p>
              </div>
              <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                <p className="text-[9px] font-black text-white/40 uppercase tracking-widest mb-1">Database Hierarchy</p>
                <p className="text-xs font-bold text-white/90">Verified Community DB → LRCLIB → Gemini AI</p>
              </div>
              <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                <p className="text-[9px] font-black text-white/40 uppercase tracking-widest mb-1">Performance Mode</p>
                <p className="text-xs font-bold text-white/90">Zero-Latency Runtime Messaging + Lite Engine</p>
              </div>
            </div>
          </motion.div>
        ) : activeTab === 'report' ? (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="h-64 flex flex-col items-center justify-center text-center space-y-5 pt-10">
            <Flag className="w-12 h-12 opacity-20 mx-auto text-red-400" />
            <div>
              <h2 className="text-xl font-black text-white">Report Lyrics Issue</h2>
              <p className="text-xs text-white/50 mt-1">Found a sync error or incorrect translation?</p>
            </div>
            <button
              onClick={handleSendReport}
              className="px-8 py-3 bg-white text-black rounded-full font-black text-[10px] tracking-widest uppercase active:scale-95 transition-transform"
            >
              Submit Report
            </button>
          </motion.div>
        ) : (
          <Suspense fallback={<div className="flex justify-center pt-20"><RefreshCw className="w-6 h-6 animate-spin text-white/40" /></div>}>
            <AdminPanel onBack={() => setActiveTab('home')} />
          </Suspense>
        )}
      </main>

      {/* Floating Hinglish Toggle & Resume Scroll Pill (Home only) */}
      {activeTab === 'home' && (
        <div className="absolute bottom-20 left-0 right-0 flex justify-center items-center gap-2 z-40 pointer-events-none px-4 min-w-0 max-w-full">
          {userScrolled && (
            <button
              onClick={() => setUserScrolled(false)}
              className="pointer-events-auto flex items-center gap-1.5 px-4 py-2 rounded-full border border-white/15 bg-black/80 backdrop-blur-2xl text-[10px] font-bold text-white hover:bg-black transition-all shadow-xl active:scale-95 shrink-0 max-w-[45vw] truncate"
            >
              <ChevronDown className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Sync View</span>
            </button>
          )}

          <button
            onClick={() => setIsHinglish(!isHinglish)}
            className="pointer-events-auto flex items-center gap-2.5 px-4 min-[360px]:px-5 py-2.5 rounded-full border border-white/10 bg-black/60 backdrop-blur-2xl hover:bg-black/80 transition-all active:scale-95 shadow-2xl shrink-0 max-w-[80vw] overflow-hidden"
          >
            <div
              className={`w-2 h-2 rounded-full shrink-0 seamless-theme-glow ${isHinglish ? 'animate-pulse' : ''}`}
              style={{ backgroundColor: isHinglish ? theme.color : '#666' }}
            />
            <span className="text-[10px] font-black tracking-[2px] text-white/90 uppercase truncate">
              {isHinglish ? 'Hinglish ON' : 'Native Script'}
            </span>
          </button>
        </div>
      )}

      {/* Sleek Bottom Navigation Bar */}
      <footer className="h-16 min-h-[64px] flex items-center justify-around bg-black/60 backdrop-blur-2xl border-t border-white/[0.05] z-50 shrink-0 min-w-0 max-w-full px-4">
        <button
          onClick={() => setActiveTab('home')}
          className={`flex flex-col items-center gap-1 cursor-pointer transition-all ${
            activeTab === 'home' ? 'opacity-100 scale-105' : 'opacity-35 hover:opacity-60'
          }`}
        >
          <Home className="w-4 h-4 text-white" />
          <div className="w-1 h-1 rounded-full" style={{ backgroundColor: activeTab === 'home' ? theme.color : 'transparent' }} />
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`flex flex-col items-center gap-1 cursor-pointer transition-all ${
            activeTab === 'settings' ? 'opacity-100 scale-105' : 'opacity-35 hover:opacity-60'
          }`}
        >
          <Settings className="w-4 h-4 text-white" />
          <div className="w-1 h-1 rounded-full" style={{ backgroundColor: activeTab === 'settings' ? theme.color : 'transparent' }} />
        </button>

        <button
          onClick={() => setActiveTab('report')}
          className={`flex flex-col items-center gap-1 cursor-pointer transition-all ${
            activeTab === 'report' ? 'opacity-100 scale-105' : 'opacity-35 hover:opacity-60'
          }`}
        >
          <Flag className="w-4 h-4 text-white" />
          <div className="w-1 h-1 rounded-full" style={{ backgroundColor: activeTab === 'report' ? theme.color : 'transparent' }} />
        </button>
      </footer>
    </div>
  );
}