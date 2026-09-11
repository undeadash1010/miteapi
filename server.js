const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8080;
const YATTEE_URL = 'https://yattee-server-production-1d73.up.railway.app';

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

    // Cookie-based session
    const cookies = extractCookies(res);
    if (cookies) {
        sessionCookie = cookies;
        console.log('  -> SUCCESS via cookie session');
        return true;
    }

    // Token-based auth (in case the server returns a token)
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
        console.error('!! ENV VARS MISSING — add YATTEE_USER and YATTEE_PASS in the Railway Variables tab !!');
        return false;
    }

    console.log(`Logging in as "${user}"...`);

    // Strategy 1: JSON body
    try {
        const { res, text } = await attemptLogin('application/json',
            JSON.stringify({ username: user, password: pass }));
        console.log(`Login attempt [JSON]: ${res.status}`);
        if (processLoginResponse(res, text)) return true;
    } catch (e) { console.error('JSON login error:', e.message); }

    // Strategy 2: form-encoded body
    try {
        const form = new URLSearchParams({ username: user, password: pass }).toString();
        const { res, text } = await attemptLogin('application/x-www-form-urlencoded', form);
        console.log(`Login attempt [form]: ${res.status}`);
        if (processLoginResponse(res, text)) return true;
    } catch (e) { console.error('Form login error:', e.message); }

    console.error('!! ALL LOGIN STRATEGIES FAILED !!');
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

app.get('/', (req, res) => res.json({
    status: 'Mite Proxy Online',
    authenticated: !!(sessionCookie || authToken)
}));

// Proxy handler (prefix match on /api/v1 and /proxy)
app.use(['/api/v1', '/proxy'], async (req, res) => {
    try {
        if (!sessionCookie && !authToken) {
            if (!await performLogin()) {
                return res.status(401).json({ error: 'Proxy could not authenticate. Check Railway deploy logs.' });
            }
        }

        const targetUrl = `${YATTEE_URL}${req.originalUrl}`;
        let response = await fetch(targetUrl, {
            method: req.method,
            headers: { ...authHeaders(), 'Accept': 'application/json' }
        });

        // Session might have expired — re-login once and retry
        if (response.status === 401) {
            console.log('Session expired — re-logging in...');
            sessionCookie = ''; authToken = '';
            if (await performLogin()) {
                response = await fetch(targetUrl, {
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

app.listen(PORT, () => console.log(`Proxy running on port ${PORT}`));
