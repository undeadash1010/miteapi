export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const q = url.searchParams.get('q') || req.query?.q;
  const id = url.searchParams.get('id') || req.query?.id;

  try {
    /* ─── MODE 1: Get Video Streams ─── */
    if (id) {
      const metaRes = await fetch(
        `https://www.dailymotion.com/player/metadata/video/${id}`,
        {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
            Accept: 'application/json',
          },
        }
      );

      if (!metaRes.ok) {
        return res.status(404).json({ error: 'Video not found.' });
      }

      const meta = await metaRes.json();

      if (meta.error) {
        return res
          .status(400)
          .json({ error: meta.error.message || 'Unavailable.' });
      }

      const qualities = meta.qualities || {};
      let hlsUrl = '';
      let mp4Url = '';
      const videoDownloads = [];

      for (const [key, sources] of Object.entries(qualities)) {
        if (!Array.isArray(sources)) continue;
        for (const src of sources) {
          if (!src.url) continue;
          if (key === 'auto' && !hlsUrl) {
            hlsUrl = src.url;
          } else if (key !== 'auto') {
            if (!mp4Url && src.type?.includes('mp4')) mp4Url = src.url;
            videoDownloads.push({
              quality: `${key}p`,
              url: src.url,
            });
          }
        }
      }

      const streamUrl = mp4Url || hlsUrl || '';

      return res.status(200).json({
        id,
        title: meta.title || 'Untitled',
        channel: meta.owner?.screenname || meta.owner?.username || 'Creator',
        audioUrl: hlsUrl || mp4Url || '',
        videoUrl: streamUrl,
        thumbnail:
          meta.posters?.['720'] ||
          meta.posters?.['480'] ||
          meta.posters?.['240'] ||
          Object.values(meta.posters || {}).find(Boolean) ||
          '',
        downloadOptions: {
          audio: hlsUrl ? [{ quality: 'HLS Audio', url: hlsUrl }] : [],
          video: videoDownloads.slice(0, 4),
        },
      });
    }

    /* ─── MODE 2: Search ─── */
    if (q) {
      const searchRes = await fetch(
        `https://api.dailymotion.com/videos?search=${encodeURIComponent(q)}&fields=id,title,owner.screenname,duration,views_total,thumbnail_720_url,thumbnail_480_url&limit=24&sort=relevance`,
        {
          headers: {
            'User-Agent': 'Mite/2.0',
          },
        }
      );

      if (!searchRes.ok) {
        return res.status(502).json({ error: 'Search failed.' });
      }

      const data = await searchRes.json();
      const list = data.list || [];

      const videos = list.map((v) => {
        const sec = v.duration || 0;
        const m = Math.floor(sec / 60);
        const s = sec % 60;

        let views = `${v.views_total || 0} views`;
        if (v.views_total >= 1_000_000)
          views = `${(v.views_total / 1_000_000).toFixed(1)}M views`;
        else if (v.views_total >= 1_000)
          views = `${(v.views_total / 1_000).toFixed(1)}K views`;

        return {
          id: v.id,
          title: v.title || 'Untitled',
          channel: v['owner.screenname'] || 'Creator',
          duration: `${m}:${s < 10 ? '0' : ''}${s}`,
          durationSec: sec,
          views,
          thumbnail:
            v.thumbnail_720_url ||
            v.thumbnail_480_url ||
            `https://www.dailymotion.com/thumbnail/video/${v.id}`,
        };
      });

      return res.status(200).json({ results: videos });
    }

    /* ─── DEFAULT ─── */
    return res.status(200).json({
      status: 'Mite API v2 — Dailymotion',
      usage: '?q=search_term  |  ?id=video_id',
    });
  } catch (err) {
    console.error('API Error:', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}
