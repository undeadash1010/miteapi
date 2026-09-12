const path = require('path');
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8080;
const YATTEE_URL = process.env.YATTEE_URL || 'https://yattee-server-production-1d73.up.railway.app';

app.use(cors());

let sessionCookie = '';
let authToken = '';

// Node 18.14+ has getSetCookie(); fall back to raw header parsing
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
    } catch { /* body wasn't JSON */ }
    console.log('  -> Login OK but no cookie/token found. Body:', text.slice(0, 300));
    return false;
}

async function performLogin() {
    const user = process.env.YATTEE_USER;
    const pass = process.env.YATTEE_PASS;
    if (!user || !pass) {
        console.error('!! ENV VARS MISSING — add YATTEE_USER and YATTEE_PASS in Railway Variables !!');
        return false;
    }
    console.log(`Logging in as "${user}"...`);
    try {
        const { res, text } = await attemptLogin('application/json', JSON.stringify({ username: user, password: pass }));
        console.log(`Login attempt [JSON]: ${res.status}`);
        if (processLoginResponse(res, text)) return true;
    } catch (e) { console.error('JSON login error:', e.message); }
    try {
        const form = new URLSearchParams({ username: user, password: pass }).toString();
        const { res, text } = await attemptLogin('application/x-www-form-urlencoded', form);
        console.log(`Login attempt [form]: ${res.status}`);
        if (processLoginResponse(res, text)) return true;
    } catch (e) { console.error('Form login error:', e.message); }
    console.error('!! ALL LOGIN STRATEGIES FAILED — continuing unauthenticated, some endpoints may 401 !!');
    return false;
}

// Debug endpoint — open in your browser to check proxy health
app.get('/debug', async (req, res) => {
    try {
        const test = await fetch(`${YATTEE_URL}/api/v1/search?q=test&type=video`, { headers: authHeaders() });
        res.json({
            envUserSet: !!process.env.YATTEE_USER,
            envPassSet: !!process.env.YATTEE_PASS,
            hasSession: !!(sessionCookie || authToken),
            testSearchStatus: test.status,
            working: test.ok
        });
    } catch (e) {
        res.json({ error: e.message });
    }
});

app.get('/health', (req, res) => res.json({
    status: 'Mite Proxy Online',
    authenticated: !!(sessionCookie || authToken)
}));

// Proxy handler — tries the request UNAUTHENTICATED first.
// Only logs in (and retries) if Yattee actually responds 401.
// This fixes the old bug where a failed login blocked requests
// that didn't need auth in the first place.
app.use(['/api/v1', '/proxy'], async (req, res) => {
    try {
        const targetUrl = `${YATTEE_URL}${req.originalUrl}`;
        // Video relay requests can be slow (much bigger payload than audio),
        // but they should never hang forever — cap it so failures are visible.
        const isVideoDetails = /\/videos\//.test(req.originalUrl);
        const isDownloadMode = /proxy_mode=download/.test(req.originalUrl);
        const timeoutMs = isDownloadMode ? 45000 : (isVideoDetails ? 25000 : 15000);

        async function fetchWithTimeout(url, opts) {
            const controller = new AbortController();
            const t = setTimeout(() => controller.abort(), timeoutMs);
            try {
                return await fetch(url, { ...opts, signal: controller.signal });
            } finally {
                clearTimeout(t);
            }
        }

        let response;
        try {
            response = await fetchWithTimeout(targetUrl, {
                method: req.method,
                headers: { ...authHeaders(), 'Accept': 'application/json' }
            });
        } catch (e) {
            if (e.name === 'AbortError') {
                console.error(`Upstream timed out after ${timeoutMs}ms: ${targetUrl}`);
                return res.status(504).json({ error: `Upstream timed out after ${timeoutMs / 1000}s`, url: targetUrl });
            }
            throw e;
        }

        if (response.status === 401) {
            console.log('Got 401 — attempting login...');
            sessionCookie = ''; authToken = '';
            if (await performLogin()) {
                response = await fetchWithTimeout(targetUrl, {
                    method: req.method,
                    headers: { ...authHeaders(), 'Accept': 'application/json' }
                });
            }
        }

        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            const data = await response.json();
            return res.status(response.status).json(data);
        }
        const text = await response.text();
        return res.status(response.status).send(text);

    } catch (error) {
        console.error('Proxy error:', error.message);
        res.status(500).json({ error: 'Proxy internal error', details: error.message });
    }
});

// Serve the frontend — same origin as the API, so no more file:// issues
// and no more cross-origin auth headaches.
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => console.log(`Mite server running on port ${PORT}`));
