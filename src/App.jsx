import { useEffect, useState } from 'react';
import Footer from './components/Footer';
import Header from './components/Header';
import HomeView from './components/HomeView';
import LibraryView from './components/LibraryView';
import PlayerDock from './components/PlayerDock';
import PlayerModal from './components/PlayerModal';
import SearchView from './components/SearchView';
import { useLibrary } from './hooks/useLibrary';
import { useMediaPlayer } from './hooks/useMediaPlayer';
import { useSearch } from './hooks/useSearch';

export default function App() {
  const [view, setView] = useState('home');
  const [modalOpen, setModalOpen] = useState(false);
  const library = useLibrary();
  const search = useSearch();
  const player = useMediaPlayer({
    addRecent: library.addRecent,
    getPosition: library.getPosition,
    savePosition: library.savePosition,
    clearPosition: library.clearPosition
  });

  const navigate = (nextView) => {
    setView(nextView);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const startSearch = (query) => {
    search.setQuery(query);
    navigate('search');
  };

  const playTrack = (track) => {
    player.playTrack(track);
  };

  const toggleCurrentFavorite = () => {
    if (player.current) library.toggleFavorite(player.current);
  };

  useEffect(() => {
    const onKeyDown = (event) => {
      const typing = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName);
      if (event.key === 'Escape') {
        setModalOpen(false);
        return;
      }
      if (typing) return;

      if (event.code === 'Space') {
        event.preventDefault();
        player.togglePlay();
      } else if (event.key === 'ArrowLeft') {
        player.seekBy(-10);
      } else if (event.key === 'ArrowRight') {
        player.seekBy(10);
      } else if (event.key === '/') {
        event.preventDefault();
        setView('search');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        window.setTimeout(() => document.querySelector('#search-input')?.focus(), 0);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [player.seekBy, player.togglePlay]);

  return (
    <div className="min-h-screen flex flex-col selection:bg-[#f2c36b]/30">
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[520px] h-[200px] bg-[#f2c36b]/[.05] rounded-full blur-[100px]" />
      </div>

      <audio ref={player.audioRef} preload="auto" playsInline className="hidden" aria-hidden="true" />

      <Header view={view} onNavigate={navigate} />

      <main className="relative z-10 flex-1 w-full max-w-3xl mx-auto pt-[4.5rem] px-4 pb-36">
        {view === 'home' && (
          <HomeView
            recent={library.recent}
            favorites={library.favorites}
            onPlay={playTrack}
            isFavorite={library.isFavorite}
            onToggleFavorite={library.toggleFavorite}
            onClearRecent={library.clearRecent}
            onSearch={startSearch}
          />
        )}
        {view === 'search' && (
          <SearchView
            query={search.query}
            onQueryChange={search.setQuery}
            results={search.results}
            resultLabel={search.resultLabel}
            status={search.status}
            isFavorite={library.isFavorite}
            onToggleFavorite={library.toggleFavorite}
            onPlay={playTrack}
          />
        )}
        {view === 'library' && (
          <LibraryView
            favorites={library.favorites}
            recent={library.recent}
            isFavorite={library.isFavorite}
            onToggleFavorite={library.toggleFavorite}
            onPlay={playTrack}
            onClearAll={library.clearAll}
          />
        )}
      </main>

      <PlayerDock
        current={player.current}
        playing={player.playing}
        progress={player.progress}
        favorite={player.current ? library.isFavorite(player.current.id) : false}
        onOpen={() => setModalOpen(true)}
        onTogglePlay={player.togglePlay}
        onToggleFavorite={toggleCurrentFavorite}
      />

      <PlayerModal
        open={modalOpen}
        current={player.current}
        mode={player.mode}
        playing={player.playing}
        status={player.status}
        rate={player.rate}
        progress={player.progress}
        favorite={player.current ? library.isFavorite(player.current.id) : false}
        videoRef={player.videoRef}
        downloadOptions={player.downloadOptions}
        downloadStatus={player.downloadStatus}
        onClose={() => setModalOpen(false)}
        onTogglePlay={player.togglePlay}
        onToggleFavorite={toggleCurrentFavorite}
        onModeChange={player.setMode}
        onSeek={player.seekTo}
        onSeekBy={player.seekBy}
        onCycleRate={player.cycleRate}
        onLoadDownloads={player.loadDownloadOptions}
      />

      <Footer />
    </div>
  );
}
