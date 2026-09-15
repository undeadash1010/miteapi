import { HeartIcon } from './Icons';

export default function TrackCard({ track, variant = 'search', favorite = false, onPlay, onToggleFavorite }) {
  if (variant === 'recent') {
    return (
      <article onClick={() => onPlay(track)} className="card track-item rounded-xl overflow-hidden cursor-pointer group anim-row">
        <div className="relative aspect-video bg-black overflow-hidden">
          <img src={track.thumbnail} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
          <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/80 font-mono text-[10px] text-white">{track.duration}</span>
        </div>
        <div className="p-3">
          <h3 className="text-xs font-semibold text-[#e4e1e6] line-clamp-2 group-hover:text-[#f2c36b] transition-colors leading-snug">{track.title}</h3>
          <p className="text-[10px] text-[#9b8f7e] truncate mt-1.5">{track.channel}</p>
        </div>
      </article>
    );
  }

  if (variant === 'compact') {
    return (
      <div onClick={() => onPlay(track)} className="card track-item p-2.5 rounded-xl flex items-center gap-3 cursor-pointer group">
        <div className="relative w-14 h-10 rounded-lg overflow-hidden bg-black shrink-0">
          <img src={track.thumbnail} alt="" className="w-full h-full object-cover" loading="lazy" />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-[11px] font-semibold text-[#e4e1e6] truncate group-hover:text-[#f2c36b] transition-colors">{track.title}</h4>
          <p className="text-[10px] font-mono text-[#9b8f7e] mt-0.5">{track.duration}</p>
        </div>
      </div>
    );
  }

  if (variant === 'library') {
    return (
      <div onClick={() => onPlay(track)} className="card track-item p-3 rounded-xl flex items-center gap-3 cursor-pointer group">
        <div className="relative w-20 aspect-video rounded-lg overflow-hidden bg-black shrink-0">
          <img src={track.thumbnail} alt="" className="w-full h-full object-cover" loading="lazy" />
          <span className="absolute bottom-1 right-1 px-1 py-0.5 rounded bg-black/80 font-mono text-[9px] text-white">{track.duration}</span>
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-xs font-semibold text-[#e4e1e6] line-clamp-1 group-hover:text-[#f2c36b] transition-colors">{track.title}</h4>
          <p className="text-[10px] text-[#9b8f7e] truncate mt-0.5">{track.channel}</p>
        </div>
        <button
          type="button"
          onClick={(event) => { event.stopPropagation(); onToggleFavorite(track); }}
          className={`p-1.5 ${favorite ? 'text-[#f2c36b]' : 'text-[#9b8f7e]'} hover:text-[#f2c36b] shrink-0 transition-colors`}
          aria-label={favorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          <HeartIcon filled={favorite} />
        </button>
      </div>
    );
  }

  return (
    <article onClick={() => onPlay(track)} className="card track-item p-3 rounded-xl flex flex-col sm:flex-row gap-3 items-start sm:items-center cursor-pointer group anim-row">
      <div className="relative w-full sm:w-44 aspect-video rounded-lg overflow-hidden bg-black shrink-0">
        <img src={track.thumbnail} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
        <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/80 font-mono text-[10px] text-white">{track.duration}</span>
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-semibold text-[#e4e1e6] line-clamp-2 sm:line-clamp-1 group-hover:text-[#f2c36b] transition-colors leading-snug">{track.title}</h3>
        <p className="text-[11px] text-[#9b8f7e] truncate mt-1.5">{track.channel} · {track.views}</p>
      </div>
      <button
        type="button"
        onClick={(event) => { event.stopPropagation(); onToggleFavorite(track); }}
        className={`self-end sm:self-center p-2 ${favorite ? 'text-[#f2c36b]' : 'text-[#9b8f7e]'} hover:text-[#f2c36b] transition-colors`}
        aria-label={favorite ? 'Remove from favorites' : 'Add to favorites'}
      >
        <HeartIcon filled={favorite} />
      </button>
    </article>
  );
}
