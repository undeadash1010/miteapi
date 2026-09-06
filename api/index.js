import { getYT } from './_lib/yt.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const q = url.searchParams.get('q') || req.query?.q;
  const id = url.searchParams.get('id') || req.query?.id;

  try {
    const youtube = await getYT();

    if (id) {
      const info = await youtube.getInfo(id);

      const status = info.playability_status?.status;
      if (status && status !== 'OK') {
        return res.status(422).json({
          error: `Video unplayable: ${status} — ${info.playability_status?.reason || 'unknown reason'}`
        });
      }

      if (!info.basic_info?.title) {
        return res.status(502).json({
          error: 'YouTube returned an empty/stripped response (likely bot detection). Try again.'
        });
      }

      let audioUrl = '';
      try {
        const audioFormat = info.chooseFormat({ type: 'audio', quality: 'best' });
        audioUrl = audioFormat?.decipher(youtube.session.player) || audioFormat?.url || '';
      } catch (e) {
        console.warn('Audio format warning:', e.message);
      }

      let videoUrl = '';
      try {
        const videoFormat = info.chooseFormat({ type: 'video+audio', quality: 'best' });
        videoUrl = videoFormat?.decipher(youtube.session.player) || videoFormat?.url || '';
      } catch (e) {
        console.warn('Video format warning:', e.message);
      }

      const audioDownloads = (info.formats || [])
        .filter(f => f.has_audio && !f.has_video)
        .map(f => {
          let u = '';
          try { u = f.decipher(youtube.session.player) || f.url || ''; } catch { }
          return { quality: `${Math.round((f.average_bitrate || 128000) / 1000)} kbps`, url: u };
        })
        .filter(f => f.url)
        .slice(0, 3);

      const videoDownloads = (info.formats || [])
        .filter(f => f.has_video && f.has_audio)
        .map(f => {
          let u = '';
          try { u = f.decipher(youtube.session.player) || f.url || ''; } catch { }
          return { quality: f.quality_label || '720p', url: u };
        })
        .filter(f => f.url)
        .slice(0, 3);

      if (!audioUrl && !videoUrl) {
        return res.status(502).json({ error: 'Could not resolve any playable stream for this video.' });
      }

      return res.status(200).json({
        id,
        title: info.basic_info.title,
        channel: info.basic_info.author || 'Unknown',
        audioUrl,
        videoUrl,
        downloadOptions: { audio: audioDownloads, video: videoDownloads }
      });
    }

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

    return res.status(200).json({
      status: 'Mite API is active and online!',
      usage: 'Use ?q=query to search, or ?id=videoId to play.'
    });

  } catch (err) {
    console.error('Server error handling request:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}