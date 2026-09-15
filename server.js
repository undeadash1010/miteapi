const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const { Readable } = require('stream');

const app = express();
const PORT = process.env.PORT || 8080;
const YATTEE_URL = (process.env.YATTEE_URL || 'https://yattee-server-production-1d73.up.railway.app').replace(/\/+$/, '');

app.use(cors());

function upstreamMessage(error) {
    const code = error?.cause?.code;
    return code ? `${error.message} (${code})` : error.message;
}

function upstreamFailure(res, error, context = 'Upstream request failed') {
    const timedOut = error?.name === 'AbortError';
    const details = `${context}: ${upstreamMessage(error)}`;
    console.error(details);
    return res.status(timedOut ? 504 : 502).json({
        error: timedOut ? 'Upstream timed out' : 'Upstream unavailable',
        details,
        upstream: YATTEE_URL
    });
}

async function fetchWithTimeout(url, opts = {}, timeoutMs = 15000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...opts, signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
}

let sessionCookie = '';
let authToken = '';

function extractCookies(response) {
    let raw = [];
    if (typeof response.headers.getSetCookie === 'function') {
        raw = response.headers.getSetCookie();
    } else {
        const h = response.headers.get('set-cookie');
        if (h) raw = h.split(/,(?=[^;]+?=)/);
    }
    return raw.map(c => c.split(';')[0].trim()).filter(Boolean).join('; ');
}

function authHeaders() {
    const h = {};
    if (sessionCookie) h['Cookie'] = sessionCookie;
    if (authToken) h['Authorization'] = authToken;
    return h;
}

async function attemptLogin(contentType, body) {
    const res = await fetch(`${YATTEE_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': contentType },
        body
    });
    const text = await res.text();
    return { res, text };
}

function processLoginResponse(res, text) {
    if (!res.ok) {
        console.log(`  -> Rejected: ${res.status} | ${text.slice(0, 300)}`);
        return false;
    }
    const cookies = extractCookies(res);
    if (cookies) {
        sessionCookie = cookies;
        console.log('  -> SUCCESS via cookie session');
        return true;
    }
    try {
        const data = JSON.parse(text);
        const token = data.token || data.access_token || data.api_key;
        if (token) {
            authToken = token.startsWith('Bearer') ? token : `Bearer ${token}`;
            console.log('  -> SUCCESS via bearer token');
            return true;
        }
    } catch { }
    console.log('  -> Login OK but no cookie/token found. Body:', text.slice(0, 300));
    return false;
}

async function performLogin() {
    const user = process.env.YATTEE_USER;
    const pass = process.env.YATTEE_PASS;
    if (!user || !pass) {
        console.error('!! ENV VARS MISSING !!');
        return false;
    }
    console.log(`Logging in as "${user}"...`);
    try {
        const { res, text } = await attemptLogin('application/json', JSON.stringify({ username: user, password: pass }));
        if (processLoginResponse(res, text)) return true;
    } catch (e) { console.error('JSON login error:', e.message); }
    try {
        const form = new URLSearchParams({ username: user, password: pass }).toString();
        const { res, text } = await attemptLogin('application/x-www-form-urlencoded', form);
        if (processLoginResponse(res, text)) return true;
    } catch (e) { console.error('Form login error:', e.message); }
    return false;
}

app.get('/debug', async (req, res) => {
    try {
        const test = await fetchWithTimeout(`${YATTEE_URL}/api/v1/search?q=test&type=video`, { headers: authHeaders() });
        res.status(test.ok ? 200 : 502).json({
            envUserSet: !!process.env.YATTEE_USER,
            hasSession: !!(sessionCookie || authToken),
            upstream: YATTEE_URL,
            upstreamStatus: test.status,
            working: test.ok
        });
    } catch (error) {
        upstreamFailure(res, error, `Could not reach ${YATTEE_URL}`);
    }
});

app.get('/health', (req, res) => res.json({
    status: 'Mite Proxy Online',
    authenticated: !!(sessionCookie || authToken),
    upstream: YATTEE_URL
}));

// NEW: Dedicated stream proxy to securely route absolute media URLs
app.use('/proxy/stream', async (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).send('Missing url parameter');

    const customHeaders = { ...authHeaders(), 'Accept': '*/*' };
    if (req.headers.range) customHeaders['Range'] = req.headers.range;

    try {
        const response = await fetch(targetUrl, {
            headers: customHeaders,
            redirect: 'follow'
        });

        res.status(response.status);
        const headersToKeep = ['content-type', 'content-length', 'content-range', 'accept-ranges', 'cache-control'];
        response.headers.forEach((value, key) => {
            if (headersToKeep.includes(key.toLowerCase())) {
                res.setHeader(key, value);
            }
        });
        res.setHeader('Access-Control-Allow-Origin', '*');

        if (response.body) {
            return Readable.fromWeb(response.body).pipe(res);
        } else {
            return res.end();
        }
    } catch (error) {
        if (!res.headersSent) upstreamFailure(res, error, 'Media stream request failed');
    }
});

// UPDATED: Now catches relative media routes like /videoplayback alongside the API
app.use(['/api/v1', '/videoplayback', '/latest_version'], async (req, res) => {
    try {
        const targetUrl = `${YATTEE_URL}${req.originalUrl}`;
        const isVideoDetails = /\/videos\//.test(req.originalUrl) && /proxy_mode=relay/.test(req.originalUrl);
        const timeoutMs = isVideoDetails ? 25000 : 15000;

        const customHeaders = { ...authHeaders(), 'Accept': 'application/json, */*' };
        if (req.headers.range) customHeaders['Range'] = req.headers.range;

        let response;
        try {
            response = await fetchWithTimeout(targetUrl, {
                method: req.method,
                headers: customHeaders
            }, timeoutMs);
        } catch (error) {
            return upstreamFailure(res, error, `Could not reach ${YATTEE_URL}`);
        }

        if (response.status === 401) {
            sessionCookie = ''; authToken = '';
            if (await performLogin()) {
                response = await fetchWithTimeout(targetUrl, {
                    method: req.method,
                    headers: { ...authHeaders(), 'Accept': 'application/json, */*' }
                }, timeoutMs);
            }
        }

        res.status(response.status);
        const headersToKeep = ['content-type', 'content-length', 'content-range', 'accept-ranges', 'cache-control'];
        response.headers.forEach((value, key) => {
            if (headersToKeep.includes(key.toLowerCase())) {
                res.setHeader(key, value);
            }
        });
        res.setHeader('Access-Control-Allow-Origin', '*');

        const contentType = response.headers.get('content-type') || '';

        if (contentType.includes('application/json')) {
            const data = await response.json();
            return res.json(data);
        }

        if (response.body) {
            return Readable.fromWeb(response.body).pipe(res);
        } else {
            return res.end();
        }

    } catch (error) {
        if (res.headersSent) return;
        const isUpstreamError = error?.name === 'AbortError' || error?.cause?.code || error?.message === 'fetch failed';
        if (isUpstreamError) return upstreamFailure(res, error, `Could not reach ${YATTEE_URL}`);
        console.error('Proxy error:', error.message);
        res.status(500).json({ error: 'Proxy internal error', details: error.message });
    }
});

// Serve the Vite build in production. Falling back to the source entry point keeps
// `npm start` useful before the first build as well.
const distDir = path.join(__dirname, 'dist');
const frontendDir = fs.existsSync(path.join(distDir, 'index.html')) ? distDir : __dirname;
const frontendEntry = path.join(frontendDir, 'index.html');

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(frontendDir));
app.get('*', (req, res) => {
    res.sendFile(frontendEntry);
});

app.listen(PORT, () => console.log(`Mite server running on port ${PORT}`));
