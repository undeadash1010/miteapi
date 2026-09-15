import { useRef, useState } from 'react';
import { ChevronDownIcon, DownloadIcon, ForwardIcon, HeartIcon, PauseIcon, PlayIcon, RewindIcon } from './Icons';
import { formatDuration } from '../lib/media';

export default function PlayerModal({
  open,
  current,
  mode,
  playing,
  status,
  rate,
  progress,
  favorite,
  videoRef,
  downloadOptions,
  downloadStatus,
  onClose,
  onTogglePlay,
  onToggleFavorite,
  onModeChange,
  onSeek,
  onSeekBy,
  onCycleRate,
  onLoadDownloads
}) {
  const [downloadsOpen, setDownloadsOpen] = useState(false);
  const scrubberRef = useRef(null);
  const draggingRef = useRef(false);

  const seekFromEvent = (event) => {
    const rect = scrubberRef.current?.getBoundingClientRect();
    if (!rect) return;
    onSeek(Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)));
  };

  const toggleDownloads = () => {
    const nextOpen = !downloadsOpen;
    setDownloadsOpen(nextOpen);
    if (nextOpen && !downloadOptions) onLoadDownloads();
  };

  const options = [
    ...(downloadOptions?.audio || []).map((item) => ({ ...item, label: 'Audio' })),
    ...(downloadOptions?.video || []).map((item) => ({ ...item, label: 'Video' }))
  ];

  return (
    <div id="stageModal" className={`stage-modal fixed inset-0 z-50 flex items-end sm:items-center justify-center ${open ? 'open' : ''}`} aria-hidden={!open}>
      <div className="absolute inset-0 bg-black/85 backdrop-blur-xl" onClick={onClose} />
      <div id="stageCard" className="stage-card relative z-10 w-full sm:max-w-lg sm:mx-4 h-full sm:h-auto sm:max-h-[94vh] bg-[#1f1f22] sm:rounded-3xl border-t sm:border border-[#2a2a2d] p-4 sm:p-6 flex flex-col gap-5 overflow-y-auto">
        <div className="flex items-center justify-between">
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-full bg-[#2a2a2d] text-[#9b8f7e] hover:text-[#e4e1e6] flex items-center justify-center transition-colors" aria-label="Close player">
            <ChevronDownIcon />
          </button>
          <div className="flex flex-col items-center gap-0.5">
            <span className="font-display text-sm text-[#f2c36b]">mite<span className="text-[#f2c36b]/60">.</span></span>
            <span className="text-[10px] text-[#9b8f7e] font-sans uppercase tracking-widest">Now playing</span>
          </div>
          <div className="w-8" />
        </div>

        <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-black border border-[#2a2a2d]/50 shadow-lg">
          <div className={`relative flex flex-col items-center justify-center w-full h-full ${mode === 'video' ? 'hidden' : ''}`}>
            <img src={current?.thumbnail || ''} alt="" className="absolute inset-0 w-full h-full object-cover opacity-20 blur-lg scale-110" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            <div className="relative w-20 h-20 rounded-2xl overflow-hidden shadow-2xl mb-4 border border-[#353438] ring-1 ring-white/10">
              <img src={current?.thumbnail || ''} alt="" className="w-full h-full object-cover" />
            </div>
            <span className="relative text-[11px] text-[#f2c36b]/80 font-mono">{status}</span>
          </div>
          <div className={`absolute inset-0 bg-black ${mode === 'audio' ? 'hidden' : ''}`}>
            <video ref={videoRef} className="w-full h-full object-contain" playsInline preload="auto" />
          </div>
        </div>

        <div className="flex justify-center">
          <div className="inline-flex p-0.5 rounded-full bg-[#1b1b1e] border border-[#2a2a2d]">
            <button type="button" onClick={() => onModeChange('audio')} className={`px-5 py-1.5 rounded-full text-xs flex items-center gap-1.5 transition-all ${mode === 'audio' ? 'font-semibold bg-[#f2c36b] text-[#412d00]' : 'text-[#9b8f7e] hover:text-[#e4e1e6]'}`}>Audio</button>
            <button type="button" onClick={() => onModeChange('video')} className={`px-5 py-1.5 rounded-full text-xs flex items-center gap-1.5 transition-all ${mode === 'video' ? 'font-semibold bg-[#f2c36b] text-[#412d00]' : 'text-[#9b8f7e] hover:text-[#e4e1e6]'}`}>Video</button>
          </div>
        </div>

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-xl font-semibold text-[#e4e1e6] line-clamp-2 leading-snug tracking-tight">{current?.title || '-'}</h2>
            <p className="text-xs text-[#9b8f7e] truncate mt-1.5 font-sans">{current?.channel || '-'}</p>
          </div>
          <button type="button" onClick={onToggleFavorite} className={`w-9 h-9 rounded-full bg-[#2a2a2d] flex items-center justify-center shrink-0 transition-colors ${favorite ? 'text-[#f2c36b]' : 'text-[#9b8f7e] hover:text-[#f2c36b]'}`} aria-label={favorite ? 'Remove from favorites' : 'Add to favorites'}>
            <HeartIcon filled={favorite} />
          </button>
        </div>

        <div className="flex flex-col gap-1.5">
          <div
            ref={scrubberRef}
            className="scrub relative w-full h-5 flex items-center"
            onPointerDown={(event) => { draggingRef.current = true; event.currentTarget.setPointerCapture(event.pointerId); seekFromEvent(event); }}
            onPointerMove={(event) => { if (draggingRef.current) seekFromEvent(event); }}
            onPointerUp={() => { draggingRef.current = false; }}
            onPointerCancel={() => { draggingRef.current = false; }}
          >
            <div className="w-full h-1 bg-[#353438] rounded-full overflow-hidden">
              <div className="h-full bg-[#f2c36b] rounded-full" style={{ width: `${progress.duration ? (progress.currentTime / progress.duration) * 100 : 0}%` }} />
            </div>
            <div className="absolute w-3.5 h-3.5 rounded-full bg-[#f2c36b] shadow-md -translate-x-1/2" style={{ left: `${progress.duration ? (progress.currentTime / progress.duration) * 100 : 0}%` }} />
          </div>
          <div className="flex justify-between font-mono text-[11px] text-[#9b8f7e]">
            <span>{formatDuration(progress.currentTime)}</span>
            <span>{formatDuration(progress.duration)}</span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <button type="button" onClick={onCycleRate} className="px-2.5 py-1 rounded-full bg-[#2a2a2d] font-mono text-[11px] text-[#9b8f7e] hover:text-[#e4e1e6] transition-colors">{rate}x</button>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => onSeekBy(-10)} className="w-10 h-10 rounded-full flex items-center justify-center text-[#9b8f7e] hover:text-[#e4e1e6] active:scale-90 transition-all" aria-label="Rewind 10 seconds"><RewindIcon /></button>
            <button type="button" onClick={onTogglePlay} className="w-14 h-14 rounded-full bg-[#f2c36b] text-[#412d00] flex items-center justify-center shadow-lg shadow-[#f2c36b]/20 hover:scale-105 active:scale-95 transition-transform" aria-label={playing ? 'Pause' : 'Play'}>
              {playing ? <PauseIcon className="w-7 h-7" /> : <PlayIcon className="w-7 h-7" />}
            </button>
            <button type="button" onClick={() => onSeekBy(10)} className="w-10 h-10 rounded-full flex items-center justify-center text-[#9b8f7e] hover:text-[#e4e1e6] active:scale-90 transition-all" aria-label="Forward 10 seconds"><ForwardIcon /></button>
          </div>
          <button type="button" onClick={toggleDownloads} className="w-9 h-9 rounded-full bg-[#2a2a2d] text-[#9b8f7e] hover:text-[#f2c36b] flex items-center justify-center transition-colors" aria-label="Toggle downloads"><DownloadIcon /></button>
        </div>

        {downloadsOpen && (
          <div className="flex flex-col gap-2 pt-4 border-t border-[#2a2a2d]">
            <span className="text-[10px] uppercase tracking-wider font-mono text-[#9b8f7e]">Direct Download</span>
            {downloadStatus === 'loading' ? (
              <p className="text-center text-[#9b8f7e] italic py-3 text-[11px]">Resolving links...</p>
            ) : downloadStatus === 'error' ? (
              <p className="text-center text-[#ffb4ab] italic py-3 text-[11px]">Could not resolve links</p>
            ) : options.length ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {options.map((option, index) => (
                  <a key={`${option.label}-${option.quality}-${index}`} href={option.url} target="_blank" rel="noopener noreferrer" download className="p-3 rounded-xl bg-[#2a2a2d] hover:bg-[#353438] flex justify-between items-center group transition-colors">
                    <span className="font-medium text-[#e4e1e6] group-hover:text-[#f2c36b] transition-colors">{option.label} · {option.quality}</span>
                    <DownloadIcon className="w-4 h-4 text-[#f2c36b]" />
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-center text-[#9b8f7e] italic py-3 text-[11px]">No download links available</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
