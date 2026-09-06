import express from 'express';
import cors from 'cors';
import yts from 'yt-search';
import { execa } from 'execa';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// 1. Search Endpoint
app.get('/api/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.status(400).json({ error: 'Query required' });

    const r = await yts(q);
    const results = r.videos.slice(0, 20).map(v => ({
      id: v.videoId,
      title: v.title,
      channel: v.author.name,
      duration: v.timestamp,
      thumbnail: v.thumbnail,
      url: v.url
    }));

    res.json({ results });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Search failed' });
  }
});

// 2. Stream Endpoint (Proxy the audio/video)
app.get('/api/stream', async (req, res) => {
  try {
    const { id, format } = req.query; // format: 'audio' or 'video'
    if (!id) return res.status(400).json({ error: 'ID required' });

    const url = `https://www.youtube.com/watch?v=${id}`;
    
    // yt-dlp arguments
    const args = [
      '-f', format === 'video' ? 'bestvideo+bestaudio/best' : 'bestaudio/best',
      '--no-cache-dir',
      '-o', '-', // Output to stdout
      url
    ];

    // Spawn yt-dlp process
    const process = execa('yt-dlp', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 1024 * 1024 * 100 // 100MB buffer safety
    });

    // Set headers for streaming
    res.setHeader('Content-Type', format === 'video' ? 'video/mp4' : 'audio/webm');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range');
    res.setHeader('Accept-Ranges', 'bytes');

    // Pipe stdout directly to response
    process.stdout.pipe(res);

    // Handle errors
    process.stderr.on('data', (data) => {
      console.log(`yt-dlp: ${data}`);
    });

    process.on('error', (err) => {
      console.error('Stream error:', err);
      if (!res.headersSent) res.status(500).json({ error: 'Stream failed' });
    });

  } catch (e) {
    console.error(e);
    if (!res.headersSent) res.status(500).json({ error: 'Server error' });
  }
});

// 3. Health Check
app.get('/', (req, res) => {
  res.json({ status: 'Mite API is running on Railway' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
