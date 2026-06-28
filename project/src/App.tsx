import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Play, Pause, SkipBack, SkipForward,
  Volume2, VolumeX, Shuffle, Repeat,
  Music, Heart, Clock, Settings, Loader2,
} from 'lucide-react';
import Player3D from './Player3D';
import AdminPanel from './AdminPanel';
import { supabase } from './lib/supabase';
import type { Track } from './lib/supabase';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function App() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbReady, setDbReady] = useState(true);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [muted, setMuted] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [showAdmin, setShowAdmin] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const track = tracks[currentIndex] ?? null;

  // ─── Load tracks ─────────────────────────────────────────────
  const loadTracks = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('tracks')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      if (error.message.includes('relation "tracks" does not exist') ||
          error.code === '42P01') {
        setDbReady(false);
        setShowAdmin(true);
      }
      setTracks([]);
    } else {
      setDbReady(true);
      setTracks(data ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadTracks(); }, [loadTracks]);

  // ─── Real audio element ───────────────────────────────────────
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.volume = volume;
    }
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.volume = muted ? 0 : volume;
  }, [volume, muted]);

  useEffect(() => {
    if (!track || !audioRef.current) return;
    const audio = audioRef.current;

    if (track.audio_url) {
      audio.src = track.audio_url;
      if (isPlaying) {
        audio.play().catch(() => {});
      } else {
        audio.pause();
      }
    } else {
      audio.pause();
      audio.src = '';
    }
  }, [track?.id, track?.audio_url]);

  useEffect(() => {
    if (!audioRef.current || !track) return;
    const audio = audioRef.current;
    if (track.audio_url) {
      if (isPlaying) audio.play().catch(() => {});
      else audio.pause();
    }
  }, [isPlaying]);

  // ─── Simulation timer (fallback when no real audio) ──────────
  const clearTimer = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  const duration = track?.duration ?? 1;

  const startTimer = useCallback(() => {
    clearTimer();
    intervalRef.current = setInterval(() => {
      setElapsed((prev) => {
        const next = prev + 1;
        if (next >= duration) {
          clearTimer();
          if (repeat) {
            setElapsed(0); setProgress(0);
          } else {
            setIsPlaying(false); setElapsed(0); setProgress(0);
            setCurrentIndex(i => shuffle
              ? Math.floor(Math.random() * tracks.length)
              : (i + 1) % Math.max(tracks.length, 1));
          }
          return 0;
        }
        setProgress((next / duration) * 100);
        return next;
      });
    }, 1000);
  }, [duration, repeat, shuffle, tracks.length]);

  useEffect(() => {
    if (isPlaying && !track?.audio_url) startTimer();
    else clearTimer();
    return clearTimer;
  }, [isPlaying, track?.audio_url, startTimer]);

  // sync real audio progress
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !track?.audio_url) return;
    const onTimeUpdate = () => {
      const dur = audio.duration || track.duration;
      setElapsed(Math.floor(audio.currentTime));
      setProgress((audio.currentTime / dur) * 100);
    };
    const onEnded = () => {
      setElapsed(0); setProgress(0);
      if (repeat) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      } else {
        setIsPlaying(false);
        setCurrentIndex(i => shuffle
          ? Math.floor(Math.random() * tracks.length)
          : (i + 1) % Math.max(tracks.length, 1));
      }
    };
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
    };
  }, [track?.id, track?.audio_url, track?.duration, repeat, shuffle, tracks.length]);

  // ─── Controls ────────────────────────────────────────────────
  const resetPosition = () => { setElapsed(0); setProgress(0); };

  const handleTrackSelect = (index: number) => {
    setCurrentIndex(index);
    resetPosition();
    setIsPlaying(true);
    if (audioRef.current && tracks[index]?.audio_url) {
      audioRef.current.src = tracks[index].audio_url;
      audioRef.current.currentTime = 0;
    }
  };

  const handlePlayPause = () => setIsPlaying(p => !p);

  const handlePrev = () => {
    resetPosition();
    const next = (currentIndex - 1 + tracks.length) % Math.max(tracks.length, 1);
    setCurrentIndex(next);
    setIsPlaying(true);
    if (audioRef.current && tracks[next]?.audio_url) {
      audioRef.current.src = tracks[next].audio_url;
      audioRef.current.currentTime = 0;
    }
  };

  const handleNext = () => {
    resetPosition();
    const next = shuffle
      ? Math.floor(Math.random() * tracks.length)
      : (currentIndex + 1) % Math.max(tracks.length, 1);
    setCurrentIndex(next);
    setIsPlaying(true);
    if (audioRef.current && tracks[next]?.audio_url) {
      audioRef.current.src = tracks[next].audio_url;
      audioRef.current.currentTime = 0;
    }
  };

  const handleSeek = (ratio: number) => {
    const newTime = ratio * duration;
    setElapsed(Math.floor(newTime));
    setProgress(ratio * 100);
    if (audioRef.current && track?.audio_url) {
      audioRef.current.currentTime = newTime;
    }
  };

  const handleSeekBar = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    handleSeek(Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)));
  };

  const toggleLike = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setLiked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // ─── Render ──────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0b0b10] text-white flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 px-5 sm:px-8 py-4 flex items-center justify-between border-b border-white/5 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-red-900 flex items-center justify-center">
            <Music size={16} className="text-white" />
          </div>
          <span className="text-lg font-semibold tracking-tight">SS | Waves 🎧</span>
        </div>
        <button
          onClick={() => setShowAdmin(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-white/50
                     hover:text-white hover:bg-white/8 border border-white/8 hover:border-white/20
                     transition-all duration-150"
        >
          <Settings size={14} />
          <span className="hidden sm:inline">Manage</span>
        </button>
      </header>

      {/* Body */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left — 3D player */}
        <aside className="w-full lg:w-[420px] xl:w-[460px] flex-shrink-0 flex items-start justify-center
                          bg-gradient-to-b from-[#0f0f18] to-[#0b0b10]
                          border-b lg:border-b-0 lg:border-r border-white/5
                          px-4 py-6 lg:py-10 lg:px-6 lg:overflow-y-auto">
          <div className="w-full max-w-sm">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 size={28} className="animate-spin text-cyan-500/60" />
                <p className="text-sm text-white/30">Loading tracks…</p>
              </div>
            ) : track ? (
              <Player3D
                track={{ id: track.id, title: track.title, artist: track.artist, cover: track.cover_url, duration: track.duration }}
                isPlaying={isPlaying}
                elapsed={elapsed}
                progress={progress}
                liked={liked.has(track.id)}
                onPlayPause={handlePlayPause}
                onPrev={handlePrev}
                onNext={handleNext}
                onSeek={handleSeek}
                onToggleLike={() => toggleLike(track.id)}
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
                <Music size={32} className="text-white/15" />
                <p className="text-sm text-white/30">No tracks yet.</p>
                <button onClick={() => setShowAdmin(true)}
                  className="text-sm text-cyan-400 hover:text-cyan-300 underline">
                  Add your first track
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* Right — Track list */}
        <main className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Your Library</h1>
                <p className="text-sm text-white/40 mt-1">{tracks.length} tracks</p>
              </div>
            </div>

            {/* Column headers */}
            <div className="hidden sm:grid grid-cols-[2rem_1fr_1fr_4rem_2rem] gap-3 px-3 mb-2
                            text-xs font-medium text-white/25 uppercase tracking-widest">
              <span>#</span>
              <span>Title</span>
              <span>Album</span>
              <span className="flex items-center justify-end gap-1"><Clock size={11} /></span>
              <span />
            </div>

            {loading ? (
              <div className="flex justify-center py-16">
                <Loader2 size={24} className="animate-spin text-white/20" />
              </div>
            ) : tracks.length === 0 ? (
              <div className="flex flex-col items-center py-16 gap-2">
                <Music size={32} className="text-white/10" />
                <p className="text-sm text-white/30">No tracks yet.</p>
              </div>
            ) : (
              <div className="space-y-1">
                {tracks.map((t, i) => {
                  const isActive = currentIndex === i;
                  return (
                    <div
                      key={t.id}
                      onClick={() => handleTrackSelect(i)}
                      className={`grid grid-cols-[2rem_1fr_4rem_2rem] sm:grid-cols-[2rem_1fr_1fr_4rem_2rem]
                                  gap-3 items-center px-3 py-2.5 rounded-xl cursor-pointer group
                                  transition-all duration-150
                                  ${isActive ? 'bg-white/[0.08]' : 'hover:bg-white/[0.04]'}`}
                    >
                      <div className="flex items-center justify-center">
                        {isActive && isPlaying ? (
                          <div className="flex items-end gap-[3px] h-4">
                            <span className="eq-bar" style={{ '--delay': '0s' } as React.CSSProperties} />
                            <span className="eq-bar" style={{ '--delay': '0.2s' } as React.CSSProperties} />
                            <span className="eq-bar" style={{ '--delay': '0.4s' } as React.CSSProperties} />
                          </div>
                        ) : (
                          <span className={`text-sm ${isActive ? 'text-cyan-400' : 'text-white/25 group-hover:text-white/50'}`}>
                            {i + 1}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-lg overflow-hidden flex-shrink-0 bg-white/8">
                          {t.cover_url
                            ? <img src={t.cover_url} alt={t.title} className="w-full h-full object-cover" loading="lazy" />
                            : <div className="w-full h-full flex items-center justify-center"><Music size={14} className="text-white/20" /></div>}
                          <div className={`absolute inset-0 bg-black/50 flex items-center justify-center transition-opacity duration-150
                                          ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                            {isActive && isPlaying ? <Pause size={13} className="text-white" /> : <Play size={13} className="text-white" />}
                          </div>
                        </div>
                        <div className="min-w-0">
                          <p className={`text-sm font-medium truncate ${isActive ? 'text-cyan-400' : 'text-white'}`}>{t.title}</p>
                          <p className="text-xs text-white/40 truncate">{t.artist}</p>
                        </div>
                      </div>

                      <p className="hidden sm:block text-sm text-white/35 truncate">{t.album}</p>
                      <p className="text-xs sm:text-sm text-white/35 text-right tabular-nums">{formatTime(t.duration)}</p>

                      <button
                        onClick={(e) => toggleLike(t.id, e)}
                        className="flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Heart
                          size={14}
                          className={liked.has(t.id) ? 'fill-rose-500 text-rose-500' : 'text-white/40 hover:text-rose-400'}
                        />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Bottom player bar */}
      <div className="border-t border-white/5 bg-[#101018] px-4 sm:px-6 py-3 flex-shrink-0">
        <div className="max-w-6xl mx-auto flex items-center gap-4 sm:gap-6">
          <div className="flex items-center gap-2 sm:gap-3 w-36 sm:w-52 flex-shrink-0 min-w-0">
            <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-white/8">
              {track?.cover_url
                ? <img src={track.cover_url} alt={track.title} className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center"><Music size={14} className="text-white/20" /></div>}
            </div>
            <div className="min-w-0 hidden sm:block">
              <p className="text-xs sm:text-sm font-medium truncate">{track?.title ?? '—'}</p>
              <p className="text-xs text-white/40 truncate">{track?.artist ?? ''}</p>
            </div>
            {track && (
              <button onClick={(e) => toggleLike(track.id, e)} className="flex-shrink-0 hidden sm:block">
                <Heart size={14} className={liked.has(track.id) ? 'fill-rose-500 text-rose-500' : 'text-white/30 hover:text-rose-400 transition-colors'} />
              </button>
            )}
          </div>

          <div className="flex-1 flex flex-col items-center gap-1.5 sm:gap-2">
            <div className="flex items-center gap-3 sm:gap-5">
              <button onClick={() => setShuffle(s => !s)}
                className={`hidden sm:block transition-colors ${shuffle ? 'text-cyan-400' : 'text-white/30 hover:text-white/60'}`}>
                <Shuffle size={15} />
              </button>
              <button onClick={handlePrev} disabled={!track} className="text-white/60 hover:text-white disabled:opacity-30 transition-colors">
                <SkipBack size={18} />
              </button>
              <button onClick={handlePlayPause} disabled={!track}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white flex items-center justify-center
                           hover:scale-105 active:scale-95 transition-transform disabled:opacity-30">
                {isPlaying ? <Pause size={16} className="text-[#0b0b10]" /> : <Play size={16} className="text-[#0b0b10] ml-0.5" />}
              </button>
              <button onClick={handleNext} disabled={!track} className="text-white/60 hover:text-white disabled:opacity-30 transition-colors">
                <SkipForward size={18} />
              </button>
              <button onClick={() => setRepeat(r => !r)}
                className={`hidden sm:block transition-colors ${repeat ? 'text-cyan-400' : 'text-white/30 hover:text-white/60'}`}>
                <Repeat size={15} />
              </button>
            </div>
            <div className="w-full flex items-center gap-2 sm:gap-3">
              <span className="text-xs text-white/30 w-7 sm:w-8 text-right tabular-nums">{formatTime(elapsed)}</span>
              <div className="flex-1 h-1 bg-white/10 rounded-full cursor-pointer group/bar relative" onClick={handleSeekBar}>
                <div className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full relative" style={{ width: `${progress}%` }}>
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover/bar:opacity-100 transition-opacity shadow" />
                </div>
              </div>
              <span className="text-xs text-white/30 w-7 sm:w-8 tabular-nums">{formatTime(duration)}</span>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2 w-32 flex-shrink-0 justify-end">
            <button onClick={() => setMuted(m => !m)} className="text-white/40 hover:text-white transition-colors">
              {muted || volume === 0 ? <VolumeX size={15} /> : <Volume2 size={15} />}
            </button>
            <div className="flex-1 h-1 bg-white/10 rounded-full cursor-pointer group/vol relative"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setVolume(Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)));
                setMuted(false);
              }}>
              <div className="h-full bg-white/50 rounded-full relative" style={{ width: `${muted ? 0 : volume * 100}%` }}>
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover/vol:opacity-100 transition-opacity shadow" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Admin panel */}
      {showAdmin && (
        <AdminPanel
          tracks={tracks}
          dbReady={dbReady}
          onClose={() => setShowAdmin(false)}
          onRefresh={() => { loadTracks(); }}
        />
      )}
    </div>
  );
}
