const STORAGE_PREFIX = 'mite:';

export function readStorage(key, fallback) {
  try {
    const value = window.localStorage.getItem(`${STORAGE_PREFIX}${key}`);
    return value === null ? fallback : JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function writeStorage(key, value) {
  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(value));
  } catch {
    // Local storage can be unavailable in private or restricted browser contexts.
  }
}
