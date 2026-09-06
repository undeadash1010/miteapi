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
    // 1. Fetch Video Streams
    if (id) {
      const metaRes = await fetch(`https://www.dailymotion.com/player/metadata/video/${id}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        }
      });

      if (!metaRes.ok) {
        return res.status(404).json({ error: 'Video not found.' });
      }

      const meta = await metaRes.json();

      if (meta.error) {
        return res.status(400).json({ error: meta.error.message || 'Unavailable.' });
      }

      const qualities = meta.qualities || {};
      let streamUrl = '';
      const videoDownloads = [];

      for (const key of Object.keys(qualities)) {
        const sources = qualities[key];
        if (!Array.isArray(sources)) continue;
        for (const src of sources) {
          if (src.url) {
            if (!streamUrl) streamUrl = src.url;
            if (key !== 'auto') {
              videoDownloads.push({
                quality: `${key}p`,
                url: src.url
              });
            }
          }
        }
      }

      if (!streamUrl && qualities.auto && qualities.auto[0]?.url) {
        streamUrl = qualities.auto[0].url;
      }

      return res.status(200).json({
        id: id,
        title: meta.title || 'Untitled',
        channel: meta.owner?.screenname || 'Creator',
        audioUrl: streamUrl,
        videoUrl: streamUrl,
        thumbnail: meta.posters?.['720'] || meta.posters?.['480'] || meta.posters?.['240'] || '',
        downloadOptions: {
          audio: streamUrl ? [{ quality: 'Audio Stream', url: streamUrl }] : [],
          video: videoDownloads.length ? videoDownloads : (streamUrl ? [{ quality: 'Auto', url: streamUrl }] : [])
        }
      });
    }

    // 2. Search Videos
    if (q) {
      const searchRes = await fetch(
        `https://api.dailymotion.com/videos?search=${encodeURIComponent(q)}&fields=id,title,owner.screenname,duration,views_total,thumbnail_720_url,thumbnail_480_url&limit=24`
      );

      if (!searchRes.ok) {
        return res.status(502).json({ error: 'Search request failed.' });
      }

      const data = await searchRes.json();
      const list = data.list || [];

      const videos = list.map(v => {
        const sec = v.duration || 0;
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        const durationFormatted = `${m}:${s < 10 ? '0' : ''}${s}`;

        let views = `${v.views_total || 0} views`;
        if (v.views_total >= 1000000) {
          views = `${(v.views_total / 1000000).toFixed(1)}M views`;
        } else if (v.views_total >= 1000) {
          views = `${(v.views_total / 1000).toFixed(1)}K views`;
        }

        return {
          id: v.id,
          title: v.title || 'Untitled',
          channel: v['owner.screenname'] || 'Creator',
          duration: durationFormatted,
          durationSec: sec,
          views: views,
          thumbnail: v.thumbnail_720_url || v.thumbnail_480_url || `https://www.dailymotion.com/thumbnail/video/${v.id}`
        };
      });

      return res.status(200).json({ results: videos });
    }

    // Default status route
    return res.status(200).json({
      status: 'Mite API is online',
      usage: '?q=query OR ?id=videoId'
    });

  } catch (err) {
    console.error('API Error:', err);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
}
