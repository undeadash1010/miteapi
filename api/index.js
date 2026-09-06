import { getYT } from './_lib/yt.js';

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

    // Mode 1: Fetch Audio / Video Streams by Video ID
    if (id) {
      let info = null;
      let lastErr = null;

      // Rotate through mobile/embedded clients that bypass datacenter 400 blocks
      const clients = ['IOS', 'ANDROID', 'TV_EMBEDDED', 'WEB'];

      for (const client of clients) {
        try {
          info = await youtube.getBasicInfo(id, client);
          if (info && info.basic_info?.title) {
            break;
          }
        } catch (err) {
          lastErr = err;
          console.warn(`Client ${client} failed for ID ${id}:`, err.message);
        }
      }

      if (!info || !info.basic_info?.title) {
        return res.status(502).json({
          error: lastErr?.message || 'Could not retrieve video streams from YouTube.'
        });
      }

      // Check playability
      if (info.playability_status?.status && info.playability_status.status !== 'OK') {
        return res.status(422).json({
          error: `Video unplayable: ${info.playability_status.status} — ${info.playability_status.reason || ''}`
        });
      }

      // 1. Resolve Best Audio Stream
      let audioUrl = '';
      try {
        const audioFmt = info.chooseFormat({ type: 'audio', quality: 'best' });
        if (audioFmt) {
          try {
            audioUrl = audioFmt.decipher(youtube.session.player) || audioFmt.url || '';
          } catch {
            audioUrl = audioFmt.url || '';
          }
        }
      } catch (e) {
        console.warn('Audio format selection warning:', e.message);
      }

      // 2. Resolve Best Video Stream (Progressive muxed audio+video, or video)
      let videoUrl = '';
      try {
        let videoFmt = null;
        try {
          videoFmt = info.chooseFormat({ type: 'video+audio', quality: 'best' });
        } catch {}

        if (!videoFmt) {
          try {
            videoFmt = info.chooseFormat({ type: 'video', quality: 'best' });
          } catch {}
        }

        if (videoFmt) {
          try {
            videoUrl = videoFmt.decipher(youtube.session.player) || videoFmt.url || '';
          } catch {
            videoUrl = videoFmt.url || '';
          }
        }
      } catch (e) {
        console.warn('Video format selection warning:', e.message);
      }

      // 3. Resolve Download Formats
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
