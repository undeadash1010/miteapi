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

    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'Missing video id' });

    try {
        const youtube = await getYT();
        const info = await youtube.getInfo(id);

        const audioFmt = info.chooseFormat({ type: 'audio', quality: 'best' });
        const audioUrl = audioFmt?.decipher(youtube.session.player) || audioFmt?.url || '';

        const videoFmt = info.chooseFormat({ type: 'video+audio', quality: 'best' });
        const videoUrl = videoFmt?.decipher(youtube.session.player) || videoFmt?.url || '';

        const audioDownloads = info.formats
            .filter(f => f.has_audio && !f.has_video)
            .map(f => ({
                quality: `${Math.round((f.average_bitrate || 128000) / 1000)} kbps`,
                url: f.decipher(youtube.session.player) || f.url
            })).slice(0, 3);

        const videoDownloads = info.formats
            .filter(f => f.has_video && f.has_audio)
            .map(f => ({
                quality: f.quality_label || '720p',
                url: f.decipher(youtube.session.player) || f.url
            })).slice(0, 3);

        return res.status(200).json({
            id,
            audioUrl,
            videoUrl,
            downloadOptions: { audio: audioDownloads, video: videoDownloads }
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: err.message });
    }
}