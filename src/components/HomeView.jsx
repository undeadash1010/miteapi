import { useState } from 'react';
import { SearchIcon } from './Icons';
import TrackCard from './TrackCard';

const categories = [
  ['solo piano relaxing', 'Solo Piano'],
  ['lofi hip hop chill study', 'Lo-fi'],
  ['ambient soundscape nature rain', 'Soundscapes'],
  ['podcast interview', 'Podcasts'],
  ['audiobook', 'Audiobooks'],
  ['smooth jazz relax', 'Jazz']
];

export default function HomeView({ recent, favorites, onPlay, isFavorite, onToggleFavorite, onClearRecent, onSearch }) {
  const [query, setQuery] = useState('');

  const submitSearch = (value = query) => {
    if (value.trim()) onSearch(value.trim());
  };

  return (
    <section className="view flex flex-col gap-8 pt-2">
      <div className="flex flex-col items-center text-center gap-3 pt-4 pb-2">
        <h1 className="font-display text-4xl sm:text-5xl font-semibold text-[#e4e1e6] tracking-tight">mite<span className="text-[#f2c36b]">.</span></h1>
        <p className="text-xs tracking-[.2em] uppercase text-[#9b8f7e] font-sans font-medium">Quiet media utility</p>
      </div>

      <form
        className="relative flex items-center h-12 rounded-full bg-[#2a2a2d] px-4 border border-[#353438]/60 focus-within:border-[#f2c36b]/40 focus-within:shadow-[0_0_20px_-5px_rgba(242,195,107,.15)] transition-all"
        onSubmit={(event) => { event.preventDefault(); submitSearch(); }}
      >
        <SearchIcon className="w-5 h-5 text-[#9b8f7e] mr-3 shrink-0" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          type="search"
          autoComplete="off"
          placeholder="What do you want to listen to?"
          className="w-full bg-transparent border-none text-sm text-[#e4e1e6] placeholder:text-[#9b8f7e]/70 focus:ring-0 p-0 outline-none"
          aria-label="Search for media"
        />
      </form>

      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
        {categories.map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => submitSearch(value)}
            className="cat-pill shrink-0 px-4 h-8 rounded-full text-xs font-medium bg-[#1f1f22] text-[#d2c5b2] border border-[#2a2a2d] hover:bg-[#2a2a2d] hover:border-[#f2c36b]/20 transition-all"
          >
            {label}
          </button>
        ))}
      </div>

      <section className="flex flex-col gap-4" aria-labelledby="recent-heading">
        <div className="flex items-center justify-between">
          <h2 id="recent-heading" className="section-title text-lg">Recently played</h2>
          <button type="button" onClick={onClearRecent} className="text-[10px] text-[#9b8f7e] hover:text-[#ffb4ab] transition-colors">clear</button>
        </div>
        {recent.length ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {recent.slice(0, 6).map((track) => (
              <TrackCard key={track.id} track={track} variant="recent" onPlay={onPlay} />
            ))}
          </div>
        ) : (
          <div className="card rounded-2xl p-10 text-center">
            <p className="section-title text-base text-[#e4e1e6]/60">Nothing played yet</p>
            <p className="text-xs text-[#9b8f7e] mt-2">Search for a video above to get started.</p>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="favorites-heading">
        <div className="flex items-center justify-between">
          <h2 id="favorites-heading" className="section-title text-lg">Your favorites</h2>
          <span className="text-[10px] font-mono text-[#9b8f7e]">{favorites.length}</span>
        </div>
        {favorites.length ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {favorites.slice(0, 8).map((track) => (
              <TrackCard key={track.id} track={track} variant="compact" onPlay={onPlay} />
            ))}
          </div>
        ) : (
          <div className="card rounded-2xl p-10 text-center">
            <p className="section-title text-base text-[#e4e1e6]/60">No favorites yet</p>
            <p className="text-xs text-[#9b8f7e] mt-2">Tap the heart on any video to save it here.</p>
          </div>
        )}
      </section>
    </section>
  );
}
