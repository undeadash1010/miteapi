import { useCallback, useRef, useState } from 'react';
import { cleanTrack } from '../lib/media';
import { readStorage, writeStorage } from '../lib/storage';

const POSITION_TTL = 604800000;

function removeExpiredPositions(positions) {
  const now = Date.now();
  return Object.fromEntries(
    Object.entries(positions).filter(([, position]) => now - position.at <= POSITION_TTL)
  );
}

export function useLibrary() {
  const [recent, setRecent] = useState(() => readStorage('recent', []));
  const [favorites, setFavorites] = useState(() => readStorage('favs', []));
  const positionsRef = useRef(removeExpiredPositions(readStorage('positions', {})));

  const addRecent = useCallback((track) => {
    setRecent((previous) => {
      const next = [cleanTrack(track), ...previous.filter((item) => item.id !== track.id)].slice(0, 30);
      writeStorage('recent', next);
      return next;
    });
  }, []);

  const isFavorite = useCallback((id) => favorites.some((favorite) => favorite.id === id), [favorites]);

  const toggleFavorite = useCallback((track) => {
    if (!track) return;

    setFavorites((previous) => {
      const next = previous.some((favorite) => favorite.id === track.id)
        ? previous.filter((favorite) => favorite.id !== track.id)
        : [cleanTrack(track), ...previous];
      writeStorage('favs', next);
      return next;
    });
  }, []);

  const clearRecent = useCallback(() => {
    setRecent([]);
    writeStorage('recent', []);
  }, []);

  const clearAll = useCallback(() => {
    setRecent([]);
    setFavorites([]);
    positionsRef.current = {};
    writeStorage('recent', []);
    writeStorage('favs', []);
    writeStorage('positions', {});
  }, []);

  const getPosition = useCallback((id) => positionsRef.current[id], []);

  const savePosition = useCallback((id, currentTime, duration) => {
    if (!id || !duration || Number.isNaN(duration)) return;

    const next = { ...positionsRef.current };
    if (duration >= 600 && currentTime > 30 && duration - currentTime > 30) {
      next[id] = { t: currentTime, d: duration, at: Date.now() };
    } else {
      delete next[id];
    }

    positionsRef.current = removeExpiredPositions(next);
    writeStorage('positions', positionsRef.current);
  }, []);

  const clearPosition = useCallback((id) => {
    const next = { ...positionsRef.current };
    delete next[id];
    positionsRef.current = next;
    writeStorage('positions', next);
  }, []);

  return {
    recent,
    favorites,
    isFavorite,
    addRecent,
    toggleFavorite,
    clearRecent,
    clearAll,
    getPosition,
    savePosition,
    clearPosition
  };
}
