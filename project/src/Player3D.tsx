import { useRef, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward, Heart } from 'lucide-react';

interface Track {
  id: string;
  title: string;
  artist: string;
  cover: string;
  duration: number;
}

interface Props {
  track: Track;
  isPlaying: boolean;
  elapsed: number;
  progress: number;
  liked: boolean;
  onPlayPause: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSeek: (ratio: number) => void;
  onToggleLike: () => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function Player3D({
  track,
  isPlaying,
  elapsed,
  progress,
  liked,
  onPlayPause,
  onPrev,
  onNext,
  onSeek,
  onToggleLike,
}: Props) {
  const rotationRef = useRef(0);
  const discRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

  useEffect(() => {
    const animate = (time: number) => {
      if (lastTimeRef.current !== null) {
        const delta = time - lastTimeRef.current;
        rotationRef.current = (rotationRef.current + delta * 0.06) % 360;
        if (discRef.current) {
          discRef.current.style.transform = `rotateY(-20deg) rotateX(10deg) rotateZ(${rotationRef.current}deg)`;
        }
      }
      lastTimeRef.current = time;
      if (isPlaying) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    if (isPlaying) {
      rafRef.current = requestAnimationFrame(animate);
    } else {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastTimeRef.current = null;
    }

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying]);

  const handleSeekClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onSeek(ratio);
  };

  return (
    <div className="player3d-root">
      {/* 3D scene */}
      <div className="scene-wrapper">
        <div className="scene">
          {/* Body of player */}
          <div className="player-body">
            {/* Top face */}
            <div className="face face-top" />
            {/* Bottom face */}
            <div className="face face-bottom" />
            {/* Left face */}
            <div className="face face-left" />
            {/* Right face */}
            <div className="face face-right" />
            {/* Back face */}
            <div className="face face-back" />
            {/* Front face — main display */}
            <div className="face face-front">
              <div className="front-content">
                {/* Screen area */}
                <div className="screen">
                  <div className="screen-inner">
                    <div
                      className="screen-cover"
                      style={{ backgroundImage: `url(${track.cover})` }}
                      key={track.id}
                    />
                    <div className="screen-overlay">
                      <p className="screen-title">{track.title}</p>
                      <p className="screen-artist">{track.artist}</p>
                    </div>
                  </div>
                </div>
                {/* Speaker grille dots */}
                <div className="grille">
                  {Array.from({ length: 15 }).map((_, i) => (
                    <div key={i} className="grille-dot" />
                  ))}
                </div>
                {/* Control buttons on body */}
                <div className="body-controls">
                  <button className="body-btn" onClick={onPrev}><SkipBack size={10} /></button>
                  <button className="body-btn body-btn-play" onClick={onPlayPause}>
                    {isPlaying ? <Pause size={11} /> : <Play size={11} />}
                  </button>
                  <button className="body-btn" onClick={onNext}><SkipForward size={10} /></button>
                </div>
              </div>
            </div>
          </div>

          {/* Vinyl disc — orbiting to the side */}
          <div className="disc-orbit">
            <div className="disc" ref={discRef}>
              <div className="disc-face disc-face-front"
                style={{ backgroundImage: `url(${track.cover})` }}
                key={`disc-${track.id}`}
              >
                <div className="disc-grooves" />
                <div className="disc-label">
                  <div className="disc-label-inner" />
                </div>
              </div>
              <div className="disc-face disc-face-back" />
              <div className="disc-edge" />
            </div>
          </div>
        </div>

        {/* Shadow */}
        <div className={`player-shadow ${isPlaying ? 'shadow-pulse' : ''}`} />
      </div>

      {/* Info panel below 3D */}
      <div className="info-panel">
        <div className="info-header">
          <div>
            <h2 className="info-title">{track.title}</h2>
            <p className="info-artist">{track.artist}</p>
          </div>
          <button onClick={onToggleLike} className="like-btn">
            <Heart
              size={18}
              className={liked ? 'fill-rose-500 text-rose-500' : 'text-white/30 hover:text-rose-400'}
            />
          </button>
        </div>

        {/* Progress */}
        <div className="progress-row">
          <span className="time-label">{formatTime(elapsed)}</span>
          <div className="progress-track" onClick={handleSeekClick}>
            <div className="progress-fill" style={{ width: `${progress}%` }}>
              <div className="progress-thumb" />
            </div>
          </div>
          <span className="time-label">{formatTime(track.duration)}</span>
        </div>

        {/* Main controls */}
        <div className="main-controls">
          <button className="ctrl-btn" onClick={onPrev}><SkipBack size={22} /></button>
          <button className="ctrl-btn ctrl-btn-main" onClick={onPlayPause}>
            {isPlaying ? <Pause size={22} /> : <Play size={22} className="ml-0.5" />}
          </button>
          <button className="ctrl-btn" onClick={onNext}><SkipForward size={22} /></button>
        </div>
      </div>
    </div>
  );
}
