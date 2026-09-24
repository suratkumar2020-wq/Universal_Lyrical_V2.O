// src/Admin.tsx - Complete Lyrics Manager (Search, Edit, Add)
import { useState, useEffect } from 'react';
import { db } from './firebaseConfig'; 
import { doc, setDoc, collection, getDocs, query, orderBy } from 'firebase/firestore/lite';
import { ArrowLeft, Send, Loader2, Search, Edit3, Plus, Music } from 'lucide-react';

interface AdminProps { onBack: () => void; }
interface SongData {
  id: string;
  song: string;
  artist: string;
  lrc: string;
  hinglishLrc?: string;
}

export default function AdminPanel({ onBack }: AdminProps) {
  // View Control
  const [view, setView] = useState<'list' | 'editor'>('list');
  
  // Data States
  const [allSongs, setAllSongs] = useState<SongData[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFetching, setIsFetching] = useState(false);

  // Editor States
  const [song, setSong] = useState('');
  const [artist, setArtist] = useState('');
  const [lrcContent, setLrcContent] = useState('');
  const [hinglishLrc, setHinglishLrc] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Fetch all songs from Firebase
  const fetchSongs = async () => {
    setIsFetching(true);
    try {
      const q = query(collection(db, "verified_lyrics"), orderBy("updatedAt", "desc"));
      const querySnapshot = await getDocs(q);
      const songsArr: SongData[] = [];
      querySnapshot.forEach((doc) => {
        songsArr.push({ id: doc.id, ...doc.data() } as SongData);
      });
      setAllSongs(songsArr);
    } catch (e) { console.error(e); }
    finally { setIsFetching(false); }
  };

  useEffect(() => { if (view === 'list') fetchSongs(); }, [view]);

  // Search Filter
  const filteredSongs = allSongs.filter(s => 
    s.song.toLowerCase().includes(searchQuery.toLowerCase()) || 
    s.artist.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const openEditor = (existingSong?: SongData) => {
    if (existingSong) {
      setSong(existingSong.song);
      setArtist(existingSong.artist);
      setLrcContent(existingSong.lrc);
      setHinglishLrc(existingSong.hinglishLrc || '');
    } else {
      setSong(''); setArtist(''); setLrcContent(''); setHinglishLrc('');
    }
    setView('editor');
  };

  const saveToPublicDB = async () => {
    if (!song || !artist || !lrcContent) return alert("Fields cannot be empty!");
    setIsSaving(true);
    const songId = `${artist.toLowerCase().trim().replace(/ /g, '_')}_${song.toLowerCase().trim().replace(/ /g, '_')}`;
    
    try {
      await setDoc(doc(db, "verified_lyrics", songId), {
        song: song.trim(), artist: artist.trim(),
        lrc: lrcContent.trim(), hinglishLrc: hinglishLrc.trim(),
        updatedAt: Date.now()
      });
      alert("Changes Saved Publicly! 🔥");
      setView('list');
    } catch (e: any) { alert("Error: " + e.message); }
    finally { setIsSaving(false); }
  };

  return (
    <div className="flex flex-col h-full text-white pb-6 animate-in fade-in duration-300">
      
      {/* HEADER */}
      <div className="flex items-center justify-between mb-4 px-1">
        <button onClick={view === 'editor' ? () => setView('list') : onBack} className="flex items-center gap-2 text-zinc-500 hover:text-white transition-all">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-[10px] font-black uppercase tracking-widest">{view === 'editor' ? 'Back to List' : 'Exit Editor'}</span>
        </button>
        <div className="flex items-center gap-2">
           {view === 'list' && (
             <button onClick={() => openEditor()} className="bg-amber-600 p-1.5 rounded-lg hover:bg-amber-500 transition-colors">
               <Plus className="w-3.5 h-3.5 text-white" />
             </button>
           )}
           <h1 className="text-[12px] font-black uppercase tracking-widest text-amber-500">{view === 'list' ? 'Database' : 'Editor'}</h1>
        </div>
      </div>

      {view === 'list' ? (
        /* LIST VIEW */
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Search Bar */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input 
              placeholder="Search songs or artists..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/5 border border-white/10 pl-10 pr-4 py-3 rounded-2xl text-xs focus:border-amber-500/50 outline-none transition-all"
            />
          </div>

          {/* Songs List */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 no-scrollbar">
            {isFetching ? (
              <div className="flex justify-center pt-10"><Loader2 className="w-6 h-6 animate-spin text-zinc-600" /></div>
            ) : filteredSongs.length > 0 ? (
              filteredSongs.map((s) => (
                <div 
                  key={s.id} 
                  onClick={() => openEditor(s)}
                  className="group p-4 bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 rounded-[20px] flex items-center gap-4 cursor-pointer transition-all active:scale-[0.98]"
                >
                  <div className="w-10 h-10 rounded-xl bg-zinc-900 flex items-center justify-center border border-white/5 group-hover:border-amber-500/30">
                    <Music className="w-5 h-5 text-zinc-600 group-hover:text-amber-500 transition-colors" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold truncate text-white">{s.song}</p>
                    <p className="text-[10px] font-bold truncate opacity-40 uppercase tracking-wider">{s.artist}</p>
                  </div>
                  <Edit3 className="w-4 h-4 text-zinc-700 group-hover:text-white transition-colors" />
                </div>
              ))
            ) : (
              <p className="text-center text-zinc-600 text-[11px] pt-10 font-bold uppercase tracking-widest">No songs found</p>
            )}
          </div>
        </div>
      ) : (
        /* EDITOR VIEW */
        <div className="space-y-3 overflow-y-auto no-scrollbar pr-1 flex-1">
          <div className="space-y-2">
            <input placeholder="Song Name" value={song} onChange={e => setSong(e.target.value)} className="w-full bg-white/5 border border-white/10 p-3 rounded-xl text-sm focus:border-amber-500/50 outline-none" />
            <input placeholder="Artist Name" value={artist} onChange={e => setArtist(e.target.value)} className="w-full bg-white/5 border border-white/10 p-3 rounded-xl text-sm focus:border-amber-500/50 outline-none" />
          </div>

          <div className="space-y-1">
            <p className="text-[9px] font-black text-zinc-500 uppercase ml-1">Original LRC</p>
            <textarea placeholder="[00:12.34] Paste Original..." value={lrcContent} onChange={e => setLrcContent(e.target.value)} className="w-full h-24 bg-white/5 border border-white/10 p-3 rounded-xl text-xs font-mono resize-none focus:border-amber-500/50 outline-none" />
          </div>

          <div className="space-y-1">
            <p className="text-[9px] font-black text-zinc-500 uppercase ml-1">Hinglish LRC (Optional)</p>
            <textarea placeholder="[00:12.34] Paste Hinglish..." value={hinglishLrc} onChange={e => setHinglishLrc(e.target.value)} className="w-full h-24 bg-white/5 border border-white/10 p-3 rounded-xl text-xs font-mono text-amber-200/50 resize-none focus:border-amber-500/50 outline-none" />
          </div>

          <button onClick={saveToPublicDB} disabled={isSaving} className={`w-full py-4 rounded-2xl font-black uppercase tracking-[2px] text-[11px] flex items-center justify-center gap-2 transition-all ${isSaving ? 'bg-zinc-800 text-zinc-500' : 'bg-amber-600 hover:bg-amber-500 shadow-xl active:scale-95'}`}>
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {isSaving ? 'Saving Changes...' : 'Update Publicly'}
          </button>
        </div>
      )}
    </div>
  );
}