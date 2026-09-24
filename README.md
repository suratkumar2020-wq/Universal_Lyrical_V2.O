# 🎵 Universal_Lyrical_V2.O

> **Industry-grade, real-time synchronized lyrics & Hinglish transliteration for Spotify, YouTube, YouTube Music, and JioSaavn.**

[![Manifest V3](https://img.shields.io/badge/Chrome%20Extension-Manifest%20V3-blue.svg)](https://developer.chrome.com/docs/extensions/mv3/)
[![React 19](https://img.shields.io/badge/React-19.0-61dafb.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178c6.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.2-646cff.svg)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-4.1-38bdf8.svg)](https://tailwindcss.com/)

---

## ✨ Features

- **⚡ Zero-Lag Real-Time Sync**: Sub-second lyrics synchronization using direct `video`/`audio` and DOM media trackers with zero disk-write thrashing.
- **🌐 Native & Hinglish Transliteration**: Instant one-click toggle between native script (Hindi, Punjabi, etc.) and Romanized Hinglish.
- **🪟 Dual Display Modes**:
  - **Quick Action Popup**: Opens instantly when clicking the extension icon in the toolbar.
  - **Detached Floating Window**: Click **"Pop Out"** to launch a sleek, pinned mini-player window that stays accessible while you browse.
- **🎨 Kinetic Adaptive Theme**: Dynamic ambient glow and fluid theme adaptation matching the active music platform:
  - 🟢 **Spotify**: Emerald neon accents
  - 🔴 **YouTube / YouTube Music**: Crimson glow
  - 🔵 **JioSaavn**: Cyan wave styling
- **🛡️ 3-Tier Lyrics Engine**:
  1. **Community Verified Database**: Firestore Lite instant cache with human-verified synced lyrics (4-second IPv6-safe timeout).
  2. **LRCLIB API**: High-accuracy global synced lyrics provider.
  3. **Gemini AI Generation**: Intelligent lyrics generation with transliteration fallback for rare or unindexed tracks.
- **🔍 Manual Track Search**: Can't auto-detect a song? Use the built-in glassmorphism search drawer to find lyrics for any song in seconds.
- **📋 One-Click Copy**: Copy synced or plain lyrics directly to your clipboard with one click.
- **🛠️ Host / Admin Panel**: Dedicated manager to add, edit, and verify public LRC timestamps and translations.

---

## 🚀 Quick Start (Load in Chrome)

### 1. Clone the Repository
```bash
git clone https://github.com/suratkumar2020-wq/Universal_Lyrical_V2.O.git
cd Universal_Lyrical_V2.O
```

### 2. Build the Extension
```bash
# Install dependencies
npm install

# Build the optimized production extension
npm run build
```

### 3. Load into Google Chrome
1. Open Google Chrome and navigate to: `chrome://extensions`
2. Enable **Developer mode** toggle in the top-right corner.
3. Click the **"Load unpacked"** button.
4. Select the **`dist`** folder inside this project directory.
5. Pin **Universal_Lyrical_V2.O** to your Chrome toolbar.
6. Open **Spotify Web**, **YouTube**, or **JioSaavn**, play any song, and click the extension icon!

---

## 💻 Local Development

### Prerequisites
- Node.js 18+
- npm or pnpm

### Scripts
| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts local Express server and Vite in development mode on `http://localhost:3000` |
| `npm run build` | Compiles and optimizes the extension into the `dist/` folder |
| `npm run lint` | Performs TypeScript type-checking across all source files |
| `npm run clean` | Cross-platform cleanup of the `dist` directory |

---

## 🏗️ Architecture & Technology Stack

```
Universal_Lyrical_V2.O
├── public/
│   ├── manifest.json       # Manifest V3 configuration with icons and permissions
│   ├── background.js       # Lightweight service worker for window pop-outs
│   ├── content.js          # Zombie-proof media watcher (Spotify, YouTube, JioSaavn)
│   └── icons/              # Crisp extension icons (16px, 32px, 48px, 128px)
├── src/
│   ├── App.tsx             # Main animated React interface (Smooth scroll, karaoke glow)
│   ├── Admin.tsx           # Lazy-loaded Host editor for Firebase verified lyrics
│   ├── firebaseConfig.ts   # Tree-shaken Firebase Firestore Lite client (~200KB saved)
│   ├── index.css           # Tailwind 4 styling & kinetic equalizer animations
│   └── main.tsx            # React root mount
├── server.ts               # Express API backend with Gemini AI & LRCLIB proxy
└── vite.config.ts          # Rollup chunk optimization & path aliases
```

---

## 🔧 Bug Fixes in V2.O

- **Fixed popup blink/flash loop**: Replaced stale closure in `useEffect` with `useRef` mirror — the runtime message listener now registers once and never re-registers on song change.
- **Fixed Firebase IPv6 timeout crash**: Added `Promise.race` with a 4-second hard timeout so a slow network never hangs the popup — falls through to LRCLIB automatically.

---

## ☁️ Vercel Deployment (Backend API)

The backend in `server.ts` is configured for **Vercel Serverless Functions**:
1. Connect this repository to your Vercel account.
2. In the Vercel project settings, configure the environment variable:
   - `GEMINI_API_KEY`: Your Google Gemini API Key.
3. Deploy! Vercel will automatically route `/api/lyrics` and `/api/generate` via `vercel.json`.

---

## 📄 License
MIT License. Built with ❤️ for music lovers.
