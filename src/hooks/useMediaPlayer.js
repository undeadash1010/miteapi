import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchVideoDetails } from '../services/api';
import {
  buildDownloadOptions,
  formatDuration,
  pickBestAudio,
  pickBestProgressive,
  toProxyUrl
} from '../lib/media';

const DETAILS_CACHE_TTL = 30 * 60 * 1000;
const PLAYBACK_RATES = [1, 1.25, 1.5, 2, 0.75];

export function useMediaPlayer({ addRecent, getPosition, savePosition, clearPosition }) {
  const audioRef = useRef(null);
  const videoRef = useRef(null);
  const currentRef = useRef(null);
  const modeRef = useRef('video');
  const rateRef = useRef(1);
  const playingRef = useRef(false);
  const lastPositionSaveRef = useRef(0);
  const requestRef = useRef(0);
  const activeControllerRef = useRef(null);
  const detailsCacheRef = useRef(new Map());

  const [current, setCurrent] = useState(null);
  const [mode, setModeState] = useState('video');
  const [playing, setPlayingState] = useState(false);
  const [status, setStatus] = useState('idle');
  const [rate, setRateState] = useState(1);
  const [progress, setProgress] = useState({ currentTime: 0, duration: 0 });
  const [downloadOptions, setDownloadOptions] = useState(null);
  const [downloadStatus, setDownloadStatus] = useState('idle');

  const setPlaying = useCallback((next) => {
    playingRef.current = next;
    setPlayingState(next);
  }, []);

  const activeElement = useCallback(() => {
    return modeRef.current === 'audio' ? audioRef.current : videoRef.current;
  }, []);

  const resolveDetails = useCallback(async (id, proxyMode, signal) => {
    const key = `${id}:${proxyMode}`;
    const cached = detailsCacheRef.current.get(key);
    if (cached && Date.now() - cached.at < DETAILS_CACHE_TTL) return cached.data;

    const data = await fetchVideoDetails(id, proxyMode, { signal });
    if (detailsCacheRef.current.size > 20) {
      detailsCacheRef.current.delete(detailsCacheRef.current.keys().next().value);
    }
    detailsCacheRef.current.set(key, { at: Date.now(), data });
    return data;
  }, []);

  const updateProgress = useCallback(
    (element = activeElement()) => {
      if (!element || element !== activeElement()) return;
      const duration = Number(element.duration);
      if (!duration || Number.isNaN(duration)) return;

      const nextProgress = {
        currentTime: element.currentTime || 0,
        duration
      };
      setProgress(nextProgress);

      if (currentRef.current && Date.now() - lastPositionSaveRef.current > 10000) {
        savePosition(currentRef.current.id, nextProgress.currentTime, duration);
        lastPositionSaveRef.current = Date.now();
      }

      if ('mediaSession' in navigator) {
        try {
          navigator.mediaSession.setPositionState({
            duration,
            position: Math.min(nextProgress.currentTime, duration),
            playbackRate: element.playbackRate || 1
          });
        } catch {
          // Some browsers reject position state while metadata is still loading.
        }
      }
    },
    [activeElement, savePosition]
  );

  useEffect(() => {
    const elements = [audioRef.current, videoRef.current].filter(Boolean);
    const cleanups = elements.map((element) => {
      const onPlaying = () => {
        if (element !== activeElement()) return;
        setPlaying(true);
        setStatus(`streaming ${modeRef.current}`);
      };
      const onPause = () => {
        if (element !== activeElement()) return;
        setPlaying(false);
        savePosition(currentRef.current?.id, element.currentTime, element.duration);
      };
      const onEnded = () => {
        if (element !== activeElement()) return;
        setPlaying(false);
        if (currentRef.current) clearPosition(currentRef.current.id);
      };
      const onWaiting = () => {
        if (element === activeElement()) setStatus('buffering...');
      };
      const onCanPlay = () => {
        if (element === activeElement() && playingRef.current) setStatus(`streaming ${modeRef.current}`);
      };
      const onTimeUpdate = () => updateProgress(element);
      const onDurationChange = () => updateProgress(element);
      const onError = () => {
        if (element === activeElement() && element.src) setStatus('stream error — tap play to retry');
      };

      element.addEventListener('playing', onPlaying);
      element.addEventListener('pause', onPause);
      element.addEventListener('ended', onEnded);
      element.addEventListener('waiting', onWaiting);
      element.addEventListener('canplay', onCanPlay);
      element.addEventListener('timeupdate', onTimeUpdate);
      element.addEventListener('durationchange', onDurationChange);
      element.addEventListener('error', onError);

      return () => {
        element.removeEventListener('playing', onPlaying);
        element.removeEventListener('pause', onPause);
        element.removeEventListener('ended', onEnded);
        element.removeEventListener('waiting', onWaiting);
        element.removeEventListener('canplay', onCanPlay);
        element.removeEventListener('timeupdate', onTimeUpdate);
        element.removeEventListener('durationchange', onDurationChange);
        element.removeEventListener('error', onError);
      };
    });

    return () => cleanups.forEach((cleanup) => cleanup());
  }, [activeElement, clearPosition, savePosition, setPlaying, updateProgress]);

  const loadTrack = useCallback(
    async (track, { startAt } = {}) => {
      const requestId = ++requestRef.current;
      activeControllerRef.current?.abort();
      const controller = new AbortController();
      activeControllerRef.current = controller;

      setStatus('resolving stream...');
      setPlaying(false);
      setProgress({ currentTime: 0, duration: 0 });

      try {
        const data = await resolveDetails(track.id, 'relay', controller.signal);
        if (requestId !== requestRef.current) return;

        const target = activeElement();
        const other = modeRef.current === 'audio' ? videoRef.current : audioRef.current;
        if (!target) throw new Error('Player is not ready');

        other?.pause();
        other?.removeAttribute('src');
        other?.load();

        const best = modeRef.current === 'audio'
          ? pickBestAudio(data.adaptiveFormats)
          : pickBestProgressive(data.formatStreams);
        if (!best?.url) {
          setStatus('no playable stream found');
          return;
        }

        const source = toProxyUrl(best.url);
        const savedPosition = getPosition(track.id);
        const restoreTime = startAt ?? (
          savedPosition && savedPosition.t > 30 && savedPosition.d - savedPosition.t > 30
            ? savedPosition.t
            : 0
        );

        target.pause();

        if (restoreTime > 0) {
          const restore = () => {
            if (requestId !== requestRef.current) return;
            try {
              target.currentTime = restoreTime;
              setStatus(`resumed at ${formatDuration(restoreTime)}`);
            } catch {
              // The media element may not accept a seek until metadata is ready.
            }
          };
          target.addEventListener('loadedmetadata', restore, { once: true });
        }

        target.src = source;
        target.playbackRate = rateRef.current;
        target.load();

        try {
          await target.play();
          if (requestId === requestRef.current) {
            setPlaying(true);
            setStatus(`streaming ${modeRef.current}`);
          }
        } catch {
          if (requestId === requestRef.current) setStatus('tap play to start');
        }
      } catch (error) {
        if (error.name === 'AbortError' || requestId !== requestRef.current) return;
        setStatus(error.message || 'playback error');
      }
    },
    [activeElement, getPosition, resolveDetails, setPlaying]
  );

  const playTrack = useCallback(
    (track) => {
      if (!track) return;
      currentRef.current = track;
      setCurrent(track);
      setDownloadOptions(null);
      setDownloadStatus('idle');
      addRecent(track);
      return loadTrack(track);
    },
    [addRecent, loadTrack]
  );

  const togglePlay = useCallback(() => {
    const element = activeElement();
    if (!element || !currentRef.current) return;

    if (!element.src) {
      loadTrack(currentRef.current);
      return;
    }

    if (element.paused) {
      element.play().then(() => setPlaying(true)).catch(() => setStatus('tap play to start'));
    } else {
      element.pause();
      setPlaying(false);
    }
  }, [activeElement, loadTrack, setPlaying]);

  const setMode = useCallback(
    (nextMode) => {
      if (modeRef.current === nextMode) return;
      const previous = activeElement();
      const stamp = previous?.currentTime || 0;
      previous?.pause();
      modeRef.current = nextMode;
      setModeState(nextMode);

      if (currentRef.current) loadTrack(currentRef.current, { startAt: stamp });
    },
    [activeElement, loadTrack]
  );

  const seekTo = useCallback(
    (fraction) => {
      const element = activeElement();
      if (!element?.duration || Number.isNaN(element.duration)) return;
      const nextTime = Math.max(0, Math.min(1, fraction)) * element.duration;
      element.currentTime = nextTime;
      setProgress({ currentTime: nextTime, duration: element.duration });
    },
    [activeElement]
  );

  const seekBy = useCallback(
    (seconds) => {
      const element = activeElement();
      if (!element?.duration || Number.isNaN(element.duration)) return;
      element.currentTime = Math.max(0, Math.min(element.duration, element.currentTime + seconds));
      updateProgress(element);
    },
    [activeElement, updateProgress]
  );

  const cycleRate = useCallback(() => {
    const nextRate = PLAYBACK_RATES[(PLAYBACK_RATES.indexOf(rateRef.current) + 1) % PLAYBACK_RATES.length];
    rateRef.current = nextRate;
    setRateState(nextRate);
    if (audioRef.current) audioRef.current.playbackRate = nextRate;
    if (videoRef.current) videoRef.current.playbackRate = nextRate;
  }, []);

  const loadDownloadOptions = useCallback(async () => {
    const track = currentRef.current;
    if (!track) return null;
    if (downloadOptions) return downloadOptions;

    setDownloadStatus('loading');
    try {
      const data = await resolveDetails(track.id, 'download');
      const options = buildDownloadOptions(data);
      setDownloadOptions(options);
      setDownloadStatus('success');
      return options;
    } catch (error) {
      if (error.name !== 'AbortError') setDownloadStatus('error');
      return null;
    }
  }, [downloadOptions, resolveDetails]);

  useEffect(() => {
    if (!('mediaSession' in navigator) || !current) return undefined;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: current.title,
      artist: current.channel,
      album: 'Mite',
      artwork: current.thumbnail ? [{ src: current.thumbnail, sizes: '512x512', type: 'image/jpeg' }] : []
    });

    const handlers = [
      ['play', togglePlay],
      ['pause', togglePlay],
      ['seekbackward', () => seekBy(-10)],
      ['seekforward', () => seekBy(10)],
      ['seekto', (details) => {
        if (details.seekTime == null) return;
        const element = activeElement();
        if (element?.duration) element.currentTime = details.seekTime;
      }]
    ];

    handlers.forEach(([action, handler]) => {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        // Action handlers vary by browser.
      }
    });

    return () => {
      handlers.forEach(([action]) => {
        try {
          navigator.mediaSession.setActionHandler(action, null);
        } catch {
          // Ignore unsupported media session actions.
        }
      });
    };
  }, [activeElement, current, seekBy, togglePlay]);

  return {
    audioRef,
    videoRef,
    current,
    mode,
    playing,
    status,
    rate,
    progress,
    downloadOptions,
    downloadStatus,
    playTrack,
    togglePlay,
    setMode,
    seekTo,
    seekBy,
    cycleRate,
    loadDownloadOptions
  };
}

