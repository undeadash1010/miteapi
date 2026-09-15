export function formatDuration(seconds) {
  if (!seconds || Number.isNaN(Number(seconds))) return '0:00';
  const total = Number(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secondsPart = Math.floor(total % 60);

  if (hours > 0) {
    return `${hours}:${minutes < 10 ? '0' : ''}${minutes}:${secondsPart < 10 ? '0' : ''}${secondsPart}`;
  }

  return `${minutes}:${secondsPart < 10 ? '0' : ''}${secondsPart}`;
}

export function cleanTrack(track) {
  return {
    id: track.id,
    title: track.title,
    channel: track.channel,
    thumbnail: track.thumbnail,
    duration: track.duration,
    views: track.views
  };
}

export function mapSearchItem(video) {
  const thumbnail =
    video.videoThumbnails?.find((item) => item.quality === 'high') ||
    video.videoThumbnails?.find((item) => item.quality === 'medium') ||
    video.videoThumbnails?.[0];

  return {
    id: video.videoId,
    title: video.title,
    channel: video.author,
    thumbnail: thumbnail?.url || '',
    duration: video.liveNow ? 'LIVE' : formatDuration(video.lengthSeconds),
    views: video.viewCountText || ''
  };
}

export function pickBestAudio(formats = []) {
  const audioOnly = formats
    .filter((format) => format.type?.startsWith('audio/'))
    .sort((a, b) => (Number.parseInt(b.bitrate, 10) || 0) - (Number.parseInt(a.bitrate, 10) || 0));

  return audioOnly[0] || null;
}

export function pickBestProgressive(streams = []) {
  const playable = streams.filter((format) => format.type?.startsWith('video/'));
  if (!playable.length) return null;

  return [...playable].sort((a, b) => (b.height || 0) - (a.height || 0))[0];
}

export function toProxyUrl(url) {
  return url?.startsWith('http') ? `/proxy/stream?url=${encodeURIComponent(url)}` : url;
}

export function buildDownloadOptions(data = {}) {
  return {
    audio: (data.adaptiveFormats || [])
      .filter((format) => format.type?.startsWith('audio/'))
      .map((format) => ({
        url: toProxyUrl(format.url),
        quality: `${format.audioQuality || 'audio'} · ${format.container || ''} · ${Math.round((Number.parseInt(format.bitrate, 10) || 0) / 1000)}kbps`
      })),
    video: (data.formatStreams || [])
      .filter((format) => format.type?.startsWith('video/'))
      .map((format) => ({
        url: toProxyUrl(format.url),
        quality: `${format.resolution || format.quality} · ${format.container || ''}`
      }))
  };
}
