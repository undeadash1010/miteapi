import { HeartIcon, PauseIcon, PlayIcon } from './Icons';

export default function PlayerDock({ current, playing, progress, favorite, onOpen, onTogglePlay, onToggleFavorite }) {
  return (
    <aside className={`fixed bottom-0 inset-x-0 z-40 transition-transform duration-300 ${current ? '' : 'translate-y-full'}`}>
      <div className="mx-3 mb-[calc(.75rem+env(safe-area-inset-bottom,0px))] max-w-2xl sm:mx-auto rounded-2xl bg-[#1f1f22] shadow-[0_10px_40px_rgba(0,0,0,.7)] border border-[#353438]/80 overflow-hidden">
        <div className="h-[2px] bg-[#353438]">
          <div className="h-full bg-[#f2c36b] transition-[width] duration-150" style={{ width: `${progress.duration ? (progress.currentTime / progress.duration) * 100 : 0}%` }} />
        </div>
        <div className="h-[62px] px-3 flex items-center gap-3">
          <button type="button" onClick={onOpen} className="flex items-center gap-3 flex-1 min-w-0 text-left cursor-pointer">
            <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-black shrink-0 border border-[#353438]">
              <img src={current?.thumbnail || ''} alt="" className="w-full h-full object-cover" />
            </div>
            <div className="min-w-0">
              <h4 className="text-[13px] font-semibold text-[#e4e1e6] truncate leading-tight">{current?.title || '-'}</h4>
              <p className="text-[11px] text-[#9b8f7e] truncate mt-0.5">{current?.channel || '-'}</p>
            </div>
          </button>
          <div className="flex items-center gap-1 shrink-0">
            <button type="button" onClick={onTogglePlay} className="w-10 h-10 rounded-full bg-[#f2c36b] text-[#412d00] flex items-center justify-center shadow-md active:scale-90 transition-transform" aria-label={playing ? 'Pause' : 'Play'}>
              {playing ? <PauseIcon className="w-5 h-5" /> : <PlayIcon className="w-5 h-5" />}
            </button>
            <button type="button" onClick={onToggleFavorite} className={`w-8 h-8 flex items-center justify-center active:scale-90 transition-all ${favorite ? 'text-[#f2c36b]' : 'text-[#9b8f7e] hover:text-[#f2c36b]'}`} aria-label={favorite ? 'Remove from favorites' : 'Add to favorites'}>
              <HeartIcon filled={favorite} />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
