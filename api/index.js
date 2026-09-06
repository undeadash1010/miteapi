import { Innertube } from 'youtubei.js';

let yt = null;
async function getYT() {
  if (!yt) {
    yt = await Innertube.create({ lang: 'en', location: 'US', retrieve_player: true });
  }
  return yt;
}

export default async function handler(req, res) {
  // Set CORS headers immediately so the browser never blocks it
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Safe parameter parsing for both Vercel edge and serverless environments
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const q = url.searchParams.get('q') || req.query?.q;
  const id = url.searchParams.get('id') || req.query?.id;

  try {
    const youtube = await getYT();

    // Mode 1: Get Video Stream Details (Play/Download)
    if (id) {
      const info = await youtube.getInfo(id);

      // Extract high quality audio stream
      let audioUrl = '';
      try {
        const audioFormat = info.chooseFormat({ type: 'audio', quality: 'best' });
        audioUrl = audioFormat?.decipher(youtube.session.player) || audioFormat?.url || '';
      } catch (e) {
        console.warn('Audio format warning:', e);
      }

      // Extract progressive video stream (video + audio muxed)
      let videoUrl = '';
      try {
        const videoFormat = info.chooseFormat({ type: 'video+audio', quality: 'best' });
        videoUrl = videoFormat?.decipher(youtube.session.player) || videoFormat?.url || '';
      } catch (e) {
        console.warn('Video format warning:', e);
      }

      // Format download variants
      const audioDownloads = (info.formats || [])
        .filter(f => f.has_audio && !f.has_video)
        .map(f => ({
          quality: `${Math.round((f.average_bitrate || 128000) / 1000)} kbps`,
          url: f.decipher(youtube.session.player) || f.url || ''
        })).filter(f => f.url).slice(0, 3);

      const videoDownloads = (info.formats || [])
        .filter(f => f.has_video && f.has_audio)
        .map(f => ({
          quality: f.quality_label || '720p',
          url: f.decipher(youtube.session.player) || f.url || ''
        })).filter(f => f.url).slice(0, 3);

      return res.status(200).json({
        id,
        title: info.basic_info?.title || 'Untitled',
        channel: info.basic_info?.author || 'Unknown',
        audioUrl,
        videoUrl,
        downloadOptions: {
          audio: audioDownloads,
          video: videoDownloads
        }
      });
    }

    // Mode 2: Search YouTube
    if (q) {
      const search = await youtube.search(q, { type: 'video' });
      const videos = (search.videos || [])
        .filter(v => v.type === 'Video')
        .map(v => ({
          id: v.id,
          title: v.title?.text || 'Untitled',
          channel: v.author?.name || 'Unknown',
          duration: v.duration?.text || '0:00',
          durationSec: v.duration?.seconds || 0,
          views: v.views?.text || '0 views',
          thumbnail: v.thumbnails?.[0]?.url || ''
        }));

      return res.status(200).json({ results: videos });
    }

    // Default Fallback
    return res.status(200).json({
      status: 'Mite API is active and online!',
      usage: 'Use ?q=query to search, or ?id=videoId to play.'
    });

  } catch (err) {
    console.error('Server error handling request:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}