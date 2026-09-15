import { SearchIcon, SpinnerIcon } from './Icons';
import TrackCard from './TrackCard';

export default function SearchView({ query, onQueryChange, results, resultLabel, status, error, isFavorite, onToggleFavorite, onPlay }) {
  return (
    <section className="view flex flex-col gap-4 pt-3">
      <div className="sticky top-14 z-30 py-2 bg-[#131316]/95 backdrop-blur-md flex flex-col gap-3">
        <div className="flex items-center h-11 rounded-full bg-[#2a2a2d] px-4 border border-[#353438]/50 focus-within:border-[#f2c36b]/40 transition-all">
          <SearchIcon className="w-4 h-4 text-[#9b8f7e] mr-2.5 shrink-0" />
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            type="search"
            autoComplete="off"
            id="search-input"
            placeholder="Search tracks..."
            className="w-full bg-transparent text-sm text-[#e4e1e6] placeholder:text-[#9b8f7e]/70 focus:ring-0 border-none p-0 outline-none"
            aria-label="Search tracks"
          />
          {status === 'searching' && <SpinnerIcon className="w-4 h-4 text-[#f2c36b] shrink-0" />}
        </div>
        <div className="flex items-center justify-between px-1">
          <span className="text-[10px] font-mono text-[#9b8f7e]">{resultLabel}</span>
          <span className="flex items-center gap-1.5 text-[10px] font-mono text-[#9b8f7e]"><span className="amber-dot amber-dot-small" />streaming</span>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {status === 'error' ? (
          <div className="text-center py-16 text-xs text-[#ffb4ab]"><p>{error || 'Could not reach the API.'}</p><p className="mt-2 text-[#9b8f7e]">Check the Yattee server connection and try again.</p></div>
        ) : status === 'searching' && !results.length ? (
          <div className="text-center py-16 text-xs text-[#9b8f7e] italic">Searching tracks...</div>
        ) : !query.trim() ? (
          <div className="text-center py-16 text-xs text-[#9b8f7e] italic">Search for something to get started.</div>
        ) : !results.length && status === 'success' ? (
          <div className="text-center py-16">
            <p className="section-title text-base text-[#e4e1e6]/60">No results found</p>
            <p className="text-xs text-[#9b8f7e] mt-2">Try a different search term.</p>
          </div>
        ) : (
          results.map((track, index) => (
            <div key={track.id} style={{ animationDelay: `${Math.min(index, 10) * 0.04}s` }}>
              <TrackCard
                track={track}
                favorite={isFavorite(track.id)}
                onPlay={onPlay}
                onToggleFavorite={onToggleFavorite}
              />
            </div>
          ))
        )}
      </div>
    </section>
  );
}
