import { Innertube } from 'youtubei.js';

let yt = null;
async function getYT() {
    if (!yt) {
        yt = await Innertube.create({ lang: 'en', location: 'US', retrieve_player: true });
    }
    return yt;
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const { q } = req.query;
    if (!q) return res.status(400).json({ error: 'Missing search query (q)' });

    try {
        const youtube = await getYT();
        const search = await youtube.search(q, { type: 'video' });
        const videos = (search.videos || []).filter(v => v.type === 'Video').map(v => ({
            id: v.id,
            title: v.title?.text || 'Untitled',
            channel: v.author?.name || 'Unknown',
            duration: v.duration?.text || '0:00',
            durationSec: v.duration?.seconds || 0,
            views: v.views?.text || '',
            thumbnail: v.thumbnails?.[0]?.url || ''
        }));

        return res.status(200).json({ results: videos });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: err.message });
    }
}