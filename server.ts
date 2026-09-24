import express from "express";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import "dotenv/config";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import { transliterate } from "transliteration";

const app = express();
app.use(express.json());
app.use(cors());

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

// In-memory cache for API requests
const lyricsCache = new Map<string, { original: string; hinglish: string; isSynced?: boolean }>();

// API: Fetch synced lyrics (LRCLIB + transliteration)
app.get("/api/lyrics", async (req, res) => {
  const song = ((req.query.song || req.query.track || "") as string).trim();
  const artist = ((req.query.artist || "") as string).trim();

  if (!song) {
    return res.status(400).json({ status: "error", message: "Song title is required" });
  }

  const key = `${song.toLowerCase()}-${artist.toLowerCase()}`;

  // 1. Check in-memory cache
  if (lyricsCache.has(key)) {
    return res.json({ status: "success", data: lyricsCache.get(key) });
  }

  // 2. Fetch from LRCLIB
  try {
    const lrcUrl = `https://lrclib.net/api/get?track_name=${encodeURIComponent(song)}&artist_name=${encodeURIComponent(artist)}`;
    const response = await fetch(lrcUrl);

    if (response.ok) {
      const data = await response.json();
      const lyricsText = data.syncedLyrics || data.plainLyrics;

      if (lyricsText) {
        const isSynced = !!data.syncedLyrics;
        const hinglish = transliterate(lyricsText);
        const lyricData = { original: lyricsText, hinglish, isSynced };

        lyricsCache.set(key, lyricData);
        return res.json({ status: "success", data: lyricData });
      }
    }
  } catch (error) {
    console.error("LRCLIB API fetch failed:", error);
  }

  return res.json({ status: "not_found" });
});

// API: AI Generation Fallback (Gemini)
app.post("/api/generate", async (req, res) => {
  const song = ((req.body.song || "") as string).trim();
  const artist = ((req.body.artist || "") as string).trim();

  if (!song) {
    return res.status(400).json({ error: "Song title is required" });
  }

  const key = `${song.toLowerCase()}-${artist.toLowerCase()}`;

  if (lyricsCache.has(key)) {
    return res.json({ status: "success", data: lyricsCache.get(key) });
  }

  try {
    const prompt = `Provide the complete lyrics for the song "${song}" by "${artist || 'Unknown'}". Strictly provide ONLY the lyrics with no intro, headers, explanations, or metadata. If the song is in Hindi or another non-English language, include both original script and Romanized/Hinglish representation.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt
    });

    const lyrics = response.text || "";
    const hinglish = transliterate(lyrics);
    const lyricData = { original: lyrics, hinglish, isSynced: false };

    lyricsCache.set(key, lyricData);
    return res.json({ status: "success", data: lyricData });
  } catch (error) {
    console.error("AI Generation Error:", error);
    return res.status(500).json({ error: "Failed to generate lyrics with AI" });
  }
});

// API: Mock Report Endpoint
app.post("/api/report", (req, res) => {
  console.log("Report received:", req.body);
  res.json({ status: "success", message: "Report logged successfully." });
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    try {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } catch (e) {
      console.warn("Vite middleware omitted:", e);
    }

    const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
    app.listen(PORT, () => {
      console.log(`Universal Lyrics Pro Server running locally on http://localhost:${PORT}`);
    });
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }
}

startServer();

// Export for Vercel Serverless
export default app;
