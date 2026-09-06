export default async function handler(req, res) {
  // Unified CORS support
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const q = url.searchParams.get('q') || req.query?.q;
  const id = url.searchParams.get('id') || req.query?.id;
  const proxyId = url.searchParams.get('proxy') || req.query?.proxy;

  try {
    /* ─── 1. HIGH SPEED STREAM PROXY (Pipes raw bytes, bypasses 403 blocks) ─── */
    if (proxyId) {
      const metaRes = await fetch(`https://www.dailymotion.com/player/metadata/video/${proxyId}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (!metaRes.ok) return res.status(404).send('Media not found.');
      const meta = await metaRes.json();
      const qualities = meta.qualities || {};
      
      // Select the best direct MP4 quality to allow native browser range scrubbing
      let streamUrl = '';
      for (const key of ['720', '480', '360', '240', 'auto']) {
        const sources = qualities[key];
        if (Array.isArray(sources)) {
          const mp4 = sources.find(s => s.type?.includes('mp4') && s.url);
          if (mp4) {
            streamUrl = mp4.url;
            break;
          }
          if (sources[0]?.url) {
            streamUrl = sources[0].url;
          }
        }
      }

      if (!streamUrl) return res.status(404).send('No stream available.');

      // Forward standard byte range requests for audio scrubbing
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      };
      if (req.headers.range) {
        headers['Range'] = req.headers.range;
      }

      const streamRes = await fetch(streamUrl, { headers });

      // Forward media headers
      res.setHeader('Content-Type', streamRes.headers.get('content-type') || 'video/mp4');
      if (streamRes.headers.get('content-length')) {
        res.setHeader('Content-Length', streamRes.headers.get('content-length'));
      }
      if (streamRes.headers.get('content-range')) {
        res.setHeader('Content-Range', streamRes.headers.get('content-range'));
      }
      res.setHeader('Accept-Ranges', 'bytes');
      res.status(streamRes.status);

      // Pipe the stream chunks directly to the client browser
      const reader = streamRes.body.getReader();
      const pipeStream = new ReadableStream({
        async start(controller) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(value);
          }
          res.end();
          controller.close();
        }
      });
      return;
    }

    /* ─── 2. SINGLE VIDEO METADATA ─── */
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

      const host = req.headers.host || 'miteapi.vercel.app';
      const proxyUrl = `https://${host}/api?proxy=${id}`;

      return res.status(200).json({
        id: v.id,
        title: v.title || 'Untitled',
        channel: v['owner.screenname'] || 'Creator',
        duration: `${m}:${s < 10 ? '0' : ''}${s}`,
        durationSec: sec,
        audioUrl: proxyUrl,
        videoUrl: proxyUrl,
        thumbnail: v.thumbnail_720_url || v.thumbnail_480_url || `https://www.dailymotion.com/thumbnail/video/${v.id}`,
        downloadOptions: {
          audio: [{ quality: 'Audio Link', url: proxyUrl }],
          video: [{ quality: 'Video Link', url: proxyUrl }]
        }
      });
    }

    /* ─── 3. SEARCH ─── */
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

    return res.status(200).json({ status: 'Mite API Proxy online' });
  } catch (err) {
    console.error('API Error:', err);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
}
