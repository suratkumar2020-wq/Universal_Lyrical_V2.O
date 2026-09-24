import { lazy, Suspense, useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { FormEvent } from 'react';
import { db } from './firebaseConfig';
import { doc, getDoc } from 'firebase/firestore/lite';

declare const chrome: any;
import {
  MoreVertical, Heart, Home, Settings, Flag, RefreshCw, Cpu,
  ExternalLink, Search, Copy, Check, Sparkles, X, ChevronDown
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

  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<any>(null);
  // Refs to hold latest song/artist without causing effect re-registration
  const songRef = useRef(song);
  const artistRef = useRef(artist);
  useEffect(() => { songRef.current = song; }, [song]);
  useEffect(() => { artistRef.current = artist; }, [artist]);

  const theme = THEMES[platform] || THEMES.spotify;
  const isWindow = typeof window !== 'undefined' && window.location.search.includes('window=true');

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

  const fetchLyrics = useCallback(async (targetSong = song, targetArtist = artist) => {
    if (!targetSong) return;
    setIsLoading(true);
    setLyrics([]);

    try {
      // 1. PRIORITY 1: Check Firebase Verified DB (4-second timeout to prevent IPv6 hangs)
      const songId = `${targetArtist.toLowerCase().trim().replace(/ /g, '_')}_${targetSong.toLowerCase().trim().replace(/ /g, '_')}`;
      try {
        const docRef = doc(db, "verified_lyrics", songId);
        const firebaseTimeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000));
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
          console.warn("Firebase timed out — skipping to LRCLIB.");
        }
      } catch (err) {
        console.warn("Firebase query skipped:", err);
      }

      // 2. PRIORITY 2: Check LRCLIB directly
      try {
        const lrcUrl = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(targetArtist)}&track_name=${encodeURIComponent(targetSong)}`;
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
      } catch (err) {
        console.warn("LRCLIB query skipped:", err);
      }

      // 3. PRIORITY 3: Cloud Backend (Vercel Serverless / AI Fallback)
      try {
        const backendUrl = `https://newuniversal-lyrics-pro.vercel.app/api/lyrics?song=${encodeURIComponent(targetSong)}&artist=${encodeURIComponent(targetArtist)}`;
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
      } catch (err) {
        console.warn("Backend API query skipped:", err);
      }
    } catch (err) {
      console.error("Lyrics Fetch Error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [song, artist, parseAndSetLRC]);

  // Extension Message & Storage Sync
  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      // 1. Initial Storage Fetch
      chrome.storage.local.get(['currentTrack', 'currentPlaybackTime'], (result) => {
        if (result.currentTrack) {
          setSong(result.currentTrack.song || '');
          setArtist(result.currentTrack.artist || '');
          if (result.currentTrack.platform) setPlatform(result.currentTrack.platform);
        }
        if (typeof result.currentPlaybackTime === 'number') {
          setCurrentTime(result.currentPlaybackTime);
        }
      });

      // 2. Real-Time Message Listener (Zero Disk Latency)
      // Uses refs so this handler is never stale and never needs re-registration
      const handleRuntimeMessage = (message: any) => {
        if (message?.type === 'PLAYBACK_TICK') {
          if (typeof message.currentTime === 'number') {
            setCurrentTime(message.currentTime);
          }
          if (typeof message.isPlaying === 'boolean') {
            setIsPlaying(message.isPlaying);
          }
          // Compare against ref (always latest) instead of stale closure variable
          if (message.song && message.song !== songRef.current) {
            setSong(message.song);
            setArtist(message.artist || '');
            if (message.platform) setPlatform(message.platform);
          }
        }
      };

      chrome.runtime.onMessage.addListener(handleRuntimeMessage);

      // 3. Storage Change Listener (Fallback)
      const handleStorageChange = (changes: any, areaName: string) => {
        if (areaName === 'local') {
          if (changes.currentTrack?.newValue) {
            const val = changes.currentTrack.newValue;
            setSong(val.song || '');
            setArtist(val.artist || '');
            if (val.platform) setPlatform(val.platform);
          }
          if (changes.currentPlaybackTime?.newValue !== undefined) {
            setCurrentTime(changes.currentPlaybackTime.newValue);
          }
        }
      };
      chrome.storage.onChanged.addListener(handleStorageChange);

      return () => {
        chrome.runtime.onMessage.removeListener(handleRuntimeMessage);
        chrome.storage.onChanged.removeListener(handleStorageChange);
      };
    }
  }, []); // Empty deps: listener registered once, refs keep it fresh

  // Auto-fetch on song change
  useEffect(() => {
    if (song) {
      fetchLyrics(song, artist);
    }
  }, [song, artist, fetchLyrics]);

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

  // Smooth Jitter-Free Auto Scroll
  useEffect(() => {
    if (activeTab !== 'home' || userScrolled) return;

    const activeEl = document.getElementById(`lyric-${activeIndex}`);
    const container = scrollRef.current;
    if (activeEl && container) {
      const containerHeight = container.clientHeight;
      const targetTop = activeEl.offsetTop - (containerHeight / 2) + (activeEl.clientHeight / 2);

      container.scrollTo({
        top: Math.max(0, targetTop),
        behavior: 'smooth'
      });
    }
  }, [activeIndex, activeTab, userScrolled]);

  // User manual scroll detection
  const handleScroll = () => {
    setUserScrolled(true);
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      setUserScrolled(false);
    }, 3500);
  };

  const handlePopOut = () => {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({ type: 'OPEN_FLOATING_WINDOW' });
      window.close();
    }
  };

  const handleCopyLyrics = () => {
    if (!lyrics.length) return;
    const text = lyrics.map(l => (isHinglish && l.translated ? `${l.translated} (${l.original})` : l.original)).join('\n');
    navigator.clipboard.writeText(text);
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
    <div className="flex flex-col w-full h-screen bg-[#080808] text-white font-sans overflow-hidden select-none relative" style={{ backgroundColor: theme.bg }}>
      {/* Background Ambient Glow */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full blur-[100px] pointer-events-none opacity-20 transition-all duration-1000"
        style={{ backgroundColor: theme.color }}
      />

      {/* Modern Header */}
      <header className="h-13 px-4 flex items-center justify-between z-50 bg-black/40 backdrop-blur-xl border-b border-white/5 relative">
        <div className="flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: theme.color, boxShadow: `0 0 8px ${theme.color}` }} />
          <span className="text-[10px] font-black tracking-[3px] uppercase text-white/70">{platform}</span>
          {isPlaying && (
            <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-white/10 text-white/80 uppercase tracking-widest">
              Live
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 text-white/40">
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
            className="px-4 py-3 bg-zinc-900/90 backdrop-blur-xl border-b border-white/10 flex flex-col gap-2 z-40 overflow-hidden"
          >
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Song name..."
                value={searchSong}
                onChange={(e) => setSearchSong(e.target.value)}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-white/40 outline-none focus:border-white/30"
              />
              <input
                type="text"
                placeholder="Artist (optional)..."
                value={searchArtist}
                onChange={(e) => setSearchArtist(e.target.value)}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-white/40 outline-none focus:border-white/30"
              />
              <button
                type="submit"
                className="px-3 py-2 rounded-xl text-xs font-bold text-black bg-white active:scale-95 transition-transform"
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
        className="flex-1 overflow-y-auto px-5 py-4 space-y-3 pb-28 no-scrollbar scroll-smooth relative"
      >
        {activeTab === 'home' ? (
          <>
            {/* Song Header & Beat Glow */}
            <section className="pt-1 pb-3 flex items-center gap-3.5 bg-gradient-to-b from-black/20 to-transparent sticky top-0 z-30 backdrop-blur-sm -mx-5 px-5">
              <div className="relative group shrink-0">
                <div className="w-13 h-13 rounded-2xl overflow-hidden shadow-2xl border border-white/10 relative z-10 bg-zinc-900 flex items-center justify-center">
                  <GlowBeat color={theme.color} isPlaying={isPlaying} />
                </div>
                <div
                  className="absolute inset-0 rounded-2xl blur-lg opacity-40 transition-opacity"
                  style={{ backgroundColor: theme.color }}
                />
              </div>

              <div className="flex flex-col min-w-0 flex-1">
                <h1 className="text-[17px] font-black text-white truncate tracking-tight">
                  {song || "Universal Lyrics Pro"}
                </h1>
                <p className="text-[12px] font-bold truncate opacity-70" style={{ color: theme.secondary }}>
                  {artist || "Play music on Spotify or YouTube"}
                </p>
              </div>

              <button
                onClick={handleCopyLyrics}
                title="Copy lyrics"
                className="p-2 text-white/40 hover:text-white transition-colors shrink-0"
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
                    className={`relative p-4 transition-all duration-300 rounded-[20px] cursor-pointer border ${
                      status === 'active'
                        ? 'bg-white/[0.06] border-white/15 shadow-xl scale-[1.02]'
                        : 'border-transparent hover:bg-white/[0.02]'
                    }`}
                  >
                    <p
                      className={`font-black leading-snug tracking-tight transition-all duration-300 ${
                        status === 'active'
                          ? 'text-[21px] text-white'
                          : status === 'passed'
                          ? 'text-[17px] opacity-35 text-white/70'
                          : 'text-[17px] opacity-20 text-white/50'
                      }`}
                    >
                      {primaryText}
                    </p>

                    {secondaryText && status === 'active' && (
                      <p className="text-[13px] font-bold mt-1.5 opacity-80" style={{ color: theme.secondary }}>
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
        <div className="absolute bottom-20 left-0 right-0 flex justify-center items-center gap-2 z-40 pointer-events-none">
          {userScrolled && (
            <button
              onClick={() => setUserScrolled(false)}
              className="pointer-events-auto flex items-center gap-1.5 px-4 py-2 rounded-full border border-white/15 bg-black/80 backdrop-blur-2xl text-[10px] font-bold text-white hover:bg-black transition-all shadow-xl active:scale-95"
            >
              <ChevronDown className="w-3.5 h-3.5" />
              <span>Sync View</span>
            </button>
          )}

          <button
            onClick={() => setIsHinglish(!isHinglish)}
            className="pointer-events-auto flex items-center gap-2.5 px-5 py-2.5 rounded-full border border-white/10 bg-black/60 backdrop-blur-2xl hover:bg-black/80 transition-all active:scale-95 shadow-2xl"
          >
            <div
              className={`w-2 h-2 rounded-full ${isHinglish ? 'animate-pulse' : ''}`}
              style={{ backgroundColor: isHinglish ? theme.color : '#666' }}
            />
            <span className="text-[10px] font-black tracking-[2px] text-white/90 uppercase">
              {isHinglish ? 'Hinglish ON' : 'Native Script'}
            </span>
          </button>
        </div>
      )}

      {/* Sleek Bottom Navigation Bar */}
      <footer className="h-16 flex items-center justify-around bg-black/60 backdrop-blur-2xl border-t border-white/[0.05] z-50 shrink-0">
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