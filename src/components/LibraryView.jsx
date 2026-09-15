import { useState } from 'react';
import TrackCard from './TrackCard';

export default function LibraryView({ favorites, recent, isFavorite, onToggleFavorite, onPlay, onClearAll }) {
  const [tab, setTab] = useState('favs');
  const items = tab === 'favs' ? favorites : recent;

  return (
    <section className="view flex flex-col gap-6 pt-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="section-title text-2xl">Library</h1>
          <p className="text-[10px] text-[#9b8f7e] mt-1 font-sans">Saved in local browser sandbox</p>
        </div>
        <button type="button" onClick={onClearAll} className="text-[10px] text-[#ffb4ab] hover:underline px-2.5 py-1 rounded-lg border border-[#ffb4ab]/20 transition-colors">Clear Vault</button>
      </div>

      <div className="flex gap-1.5 bg-[#1b1b1e] p-1 rounded-xl border border-[#2a2a2d]">
        <button type="button" onClick={() => setTab('favs')} className={`flex-1 py-1.5 rounded-lg text-xs transition-all ${tab === 'favs' ? 'font-semibold bg-[#353438] text-[#f2c36b]' : 'text-[#9b8f7e] hover:text-[#e4e1e6]'}`}>Favorites</button>
        <button type="button" onClick={() => setTab('history')} className={`flex-1 py-1.5 rounded-lg text-xs transition-all ${tab === 'history' ? 'font-semibold bg-[#353438] text-[#f2c36b]' : 'text-[#9b8f7e] hover:text-[#e4e1e6]'}`}>History</button>
      </div>

      <div className="flex flex-col gap-3">
        {items.length ? items.map((track) => (
          <TrackCard
            key={track.id}
            track={track}
            variant="library"
            favorite={isFavorite(track.id)}
            onToggleFavorite={onToggleFavorite}
            onPlay={onPlay}
          />
        )) : (
          <div className="card rounded-2xl p-10 text-center">
            <p className="section-title text-base text-[#e4e1e6]/60">Nothing here yet</p>
          </div>
        )}
      </div>
    </section>
  );
}
