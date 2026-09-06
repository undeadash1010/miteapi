export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const q = url.searchParams.get('q') || req.query?.q;
  const id = url.searchParams.get('id') || req.query?.id;

  try {
    // 1. Single Video Details
    if (id) {
      const vRes = await fetch(
        `https://api.dailymotion.com/video/${id}?fields=id,title,owner.screenname,duration,views_total,thumbnail_720_url,thumbnail_480_url`
      );

      if (!vRes.ok) {
        return res.status(404).json({ error: 'Video not found.' });
      }

      const v = await vRes.json();
      const sec = v.duration || 0;
      const m = Math.floor(sec / 60);
      const s = sec % 60;

      return res.status(200).json({
        id: v.id,
        title: v.title || 'Untitled',
        channel: v['owner.screenname'] || 'Creator',
        duration: `${m}:${s < 10 ? '0' : ''}${s}`,
        durationSec: sec,
        thumbnail: v.thumbnail_720_url || v.thumbnail_480_url || `https://www.dailymotion.com/thumbnail/video/${v.id}`
      });
    }

    // 2. Search Videos
    if (q) {
      const searchRes = await fetch(
        `https://api.dailymotion.com/videos?search=${encodeURIComponent(q)}&fields=id,title,owner.screenname,duration,views_total,thumbnail_720_url,thumbnail_480_url&limit=24&sort=relevance`
      );

      if (!searchRes.ok) {
        return res.status(502).json({ error: 'Search failed.' });
      }

      const data = await searchRes.json();
      const list = data.list || [];

      const videos = list.map(v => {
        const sec = v.duration || 0;
        const m = Math.floor(sec / 60);
        const s = sec % 60;

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
          duration: `${m}:${s < 10 ? '0' : ''}${s}`,
          durationSec: sec,
          views,
          thumbnail: v.thumbnail_720_url || v.thumbnail_480_url || `https://www.dailymotion.com/thumbnail/video/${v.id}`
        };
      });

      return res.status(200).json({ results: videos });
    }

    return res.status(200).json({ status: 'Mite API is online' });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}
