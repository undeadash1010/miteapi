import { getYT } from './_lib/yt.js';

// Public failover mirrors for emergency backup
const FALLBACK_APIS = [
  'https://inv.nadeko.net',
  'https://invidious.nerdvpn.de',
  'https://vid.puffyan.us',
  'https://invidious.jing.rocks',
  'https://pipedapi.kavin.rocks'
];

async function fetchFromFallback(id) {
  for (const host of FALLBACK_APIS) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);

      const isPiped = host.includes('piped');
      const url = isPiped ? `${host}/streams/${id}` : `${host}/api/v1/videos/${id}`;

      const res = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
      });
      clearTimeout(timeout);

      if (!res.ok) continue;
      const data = await res.json();

      // Handle Piped instances
      if (isPiped && data.title) {
        const audioStreams = data.audioStreams || [];
        const videoStreams = data.videoStreams || [];
        const bestAudio = audioStreams[audioStreams.length - 1] || audioStreams[0];
        const progVideo = videoStreams.find(v => v.videoOnly === false) || videoStreams[0];

        return {
          id,
          title: data.title || 'Untitled',
          channel: data.uploader || 'Unknown',
          audioUrl: bestAudio?.url || '',
          videoUrl: progVideo?.url || '',
          downloadOptions: {
            audio: audioStreams.slice(0, 3).map(a => ({ quality: a.quality || 'Audio', url: a.url })),
            video: videoStreams.slice(0, 3).map(v => ({ quality: v.quality || 'Video', url: v.url }))
          }
        };
      }

      // Handle Invidious instances
      if (data && data.title) {
        const progVideo = (data.formatStreams || []).find(f => f.url && f.container === 'mp4') || data.formatStreams?.[0];
        const audioStreams = (data.adaptiveFormats || []).filter(f => f.type?.startsWith('audio') && f.url);
        const bestAudio = audioStreams[audioStreams.length - 1] || audioStreams[0];

        return {
          id,
          title: data.title || 'Untitled',
          channel: data.author || 'Unknown',
          audioUrl: bestAudio?.url || progVideo?.url || '',
          videoUrl: progVideo?.url || '',
          downloadOptions: {
            audio: audioStreams.slice(0, 3).map(a => ({
              quality: `${Math.round((a.bitrate || 128000) / 1000)} kbps`,
              url: a.url
            })),
            video: (data.formatStreams || []).slice(0, 3).map(v => ({
              quality: v.resolution || v.qualityLabel || '720p',
              url: v.url
            }))
          }
        };
      }
    } catch (e) {
      // Continue to next mirror if this one fails
    }
  }
  return null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const q = url.searchParams.get('q') || req.query?.q;
  const id = url.searchParams.get('id') || req.query?.id;

  try {
    const youtube = await getYT();

    // Mode 1: Fetch Video Streams
    if (id) {
      let info = null;
      let playabilityError = null;

      // Prioritize WEB (uses your session cookie), then mobile clients
      const clients = ['WEB', 'ANDROID', 'IOS', 'TV_EMBEDDED'];

      for (const client of clients) {
        try {
          const resInfo = await youtube.getBasicInfo(id, client);
          const status = resInfo?.playability_status?.status;

          if (status === 'OK' && resInfo.basic_info?.title) {
            info = resInfo;
            break;
          } else if (resInfo?.playability_status?.reason) {
            playabilityError = resInfo.playability_status.reason;
          }
        } catch (err) {
          console.warn(`Client ${client} error for ${id}:`, err.message);
        }
      }

      // If YouTube direct extraction fails, fall back to mirrors
      if (!info || !info.basic_info?.title) {
        console.log(`YouTube direct extraction failed (${playabilityError || 'unknown'}), attempting fallback...`);
        const fallback = await fetchFromFallback(id);
        if (fallback && (fallback.audioUrl || fallback.videoUrl)) {
          return res.status(200).json(fallback);
        }

        return res.status(422).json({
          error: playabilityError || 'This video is unavailable or blocked in this region.'
        });
      }

      // Extract Best Audio Stream
      let audioUrl = '';
      try {
        const audioFmt = info.chooseFormat({ type: 'audio', quality: 'best' });
        audioUrl = audioFmt?.decipher(youtube.session.player) || audioFmt?.url || '';
      } catch (e) {
        console.warn('Audio decipher warning:', e.message);
      }

      // Extract Best Video Stream
      let videoUrl = '';
      try {
        const videoFmt = info.chooseFormat({ type: 'video+audio', quality: 'best' }) || info.chooseFormat({ type: 'video', quality: 'best' });
        videoUrl = videoFmt?.decipher(youtube.session.player) || videoFmt?.url || '';
      } catch (e) {
        console.warn('Video decipher warning:', e.message);
      }

      // Extract Download Options
      const allFormats = info.streaming_data?.adaptive_formats || info.formats || [];
      const progFormats = info.streaming_data?.formats || [];

      const audioDownloads = allFormats
        .filter(f => f.has_audio && !f.has_video)
        .map(f => {
          let u = '';
          try { u = f.decipher(youtube.session.player) || f.url || ''; } catch { u = f.url || ''; }
          return {
            quality: `${Math.round((f.average_bitrate || f.bitrate || 128000) / 1000)} kbps`,
            url: u
          };
        })
        .filter(f => f.url)
        .slice(0, 3);

      const videoDownloads = progFormats
        .map(f => {
          let u = '';
          try { u = f.decipher(youtube.session.player) || f.url || ''; } catch { u = f.url || ''; }
          return {
            quality: f.quality_label || `${f.height || 720}p`,
            url: u
          };
        })
        .filter(f => f.url)
        .slice(0, 3);

      return res.status(200).json({
        id,
        title: info.basic_info.title,
        channel: info.basic_info.author || 'Unknown',
        audioUrl: audioUrl || videoUrl,
        videoUrl: videoUrl || audioUrl,
        downloadOptions: {
          audio: audioDownloads,
          video: videoDownloads
        }
      });
    }

    // Mode 2: Search YouTube
    if (q) {
      const search = await youtube.search(q, { type: 'video' });
      const videos = (search.results || search.videos || [])
        .filter(v => v.type === 'Video' || v.id)
        .map(v => ({
          id: v.id,
          title: v.title?.text || v.title || 'Untitled',
          channel: v.author?.name || v.author || 'Unknown',
          duration: v.duration?.text || (v.duration ? `${Math.floor(v.duration / 60)}:${v.duration % 60}` : '0:00'),
          durationSec: v.duration?.seconds || v.duration || 0,
          views: v.views?.text || v.short_view_count?.text || '',
          thumbnail: v.thumbnails?.[0]?.url || `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`
        }));

      return res.status(200).json({ results: videos });
    }

    return res.status(200).json({
      status: 'Mite API is active and online!',
      usage: 'Use ?q=query to search, or ?id=videoId to play.'
    });

  } catch (err) {
    console.error('API Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
