import { useEffect, useRef, useState } from 'react';
import { searchVideos } from '../services/api';

export function useSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState('ready');
  const [error, setError] = useState('');
  const abortRef = useRef(null);

  useEffect(() => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      abortRef.current?.abort();
      setResults([]);
      setError('');
      setStatus('ready');
      return undefined;
    }

    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    setError('');
    setStatus('searching');

    const timeout = window.setTimeout(async () => {
      try {
        const nextResults = await searchVideos(trimmedQuery, { signal: controller.signal });
        if (!controller.signal.aborted) {
          setResults(nextResults);
          setError('');
          setStatus('success');
        }
      } catch (error) {
        if (error.name !== 'AbortError' && !controller.signal.aborted) {
          setResults([]);
          setError(error.message || 'The API could not be reached.');
          setStatus('error');
        }
      }
    }, 450);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [query]);

  return {
    query,
    setQuery,
    results,
    status,
    error,
    resultLabel:
      status === 'ready'
        ? 'ready'
        : status === 'searching'
          ? 'searching...'
          : status === 'error'
            ? 'error'
            : `${results.length} results`
  };
}
