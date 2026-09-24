import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';
import { transliterate } from 'transliteration';

const cache = new Map<string, { original: string; hinglish: string; isSynced: boolean }>();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const song = ((req.body?.song || '') as string).trim();
  const artist = ((req.body?.artist || '') as string).trim();

  if (!song) {
    return res.status(400).json({ error: 'Song title is required' });
  }

  const key = `${song.toLowerCase()}-${artist.toLowerCase()}`;

  if (cache.has(key)) {
    return res.json({ status: 'success', data: cache.get(key) });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `Provide the complete lyrics for the song "${song}" by "${artist || 'Unknown'}". Strictly provide ONLY the lyrics with no intro, headers, explanations, or metadata. If the song is in Hindi or another non-English language, include both original script and Romanized/Hinglish representation.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
    });

    const lyrics = response.text || '';
    const hinglish = transliterate(lyrics);
    const lyricData = { original: lyrics, hinglish, isSynced: false };

    cache.set(key, lyricData);
    return res.json({ status: 'success', data: lyricData });
  } catch (error) {
    console.error('Gemini AI Error:', error);
    return res.status(500).json({ error: 'Failed to generate lyrics with AI' });
  }
}
