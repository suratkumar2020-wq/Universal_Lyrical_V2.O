import type { VercelRequest, VercelResponse } from '@vercel/node';
import { transliterate } from 'transliteration';

// In-memory cache (lives for the duration of the function instance)
const cache = new Map<string, { original: string; hinglish: string; isSynced: boolean }>();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const song = ((req.query.song || req.query.track || '') as string).trim();
  const artist = ((req.query.artist || '') as string).trim();

  if (!song) {
    return res.status(400).json({ status: 'error', message: 'Song title is required' });
  }

  const key = `${song.toLowerCase()}-${artist.toLowerCase()}`;

  if (cache.has(key)) {
    return res.json({ status: 'success', data: cache.get(key) });
  }

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
        cache.set(key, lyricData);
        return res.json({ status: 'success', data: lyricData });
      }
    }
  } catch (error) {
    console.error('LRCLIB fetch failed:', error);
  }

  return res.json({ status: 'not_found' });
}
