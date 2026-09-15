import { mapSearchItem } from '../lib/media';

const API_BASE = import.meta.env.VITE_API_BASE || '';

function apiUrl(path) {
  return `${API_BASE}${path}`;
}

async function parseError(response, fallback) {
  const body = await response.json().catch(() => ({}));
  return new Error(body.detail || body.error || fallback);
}

export async function searchVideos(query, { signal } = {}) {
  const response = await fetch(apiUrl(`/api/v1/search?q=${encodeURIComponent(query)}&type=video`), { signal });
  if (!response.ok) throw await parseError(response, `Search failed (${response.status})`);

  const data = await response.json();
  return (Array.isArray(data) ? data : [])
    .filter((result) => result.type === 'video')
    .map(mapSearchItem);
}

export async function fetchVideoDetails(id, proxyMode, { signal } = {}) {
  const response = await fetch(
    apiUrl(`/api/v1/videos/${encodeURIComponent(id)}?proxy=true&proxy_mode=${encodeURIComponent(proxyMode)}`),
    { signal }
  );

  if (!response.ok) throw await parseError(response, `Video unavailable (${response.status})`);
  return response.json();
}
