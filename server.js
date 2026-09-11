const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const YATTEE_BASE = 'https://yattee-server-production-1d73.up.railway.app';

app.use(cors());
app.use(express.json());

let sessionCookie = null;

async function login() {
  const res = await fetch(`${YATTEE_BASE}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: process.env.YATTEE_USER,
      password: process.env.YATTEE_PASS
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Login failed: ${res.status} ${text}`);
  }

  const setCookie = res.headers.get('set-cookie');
  if (setCookie) {
    sessionCookie = setCookie.split(';')[0]; // grab just the cookie name=value
    console.log('Logged in, got session cookie');
  } else {
    console.warn('Login succeeded but no cookie returned');
  }
}

async function proxyRequest(req, res) {
  try {
    if (!sessionCookie) await login();

    const targetUrl = `${YATTEE_BASE}${req.originalUrl}`;
    let response = await fetch(targetUrl, {
      headers: { Cookie: sessionCookie || '' }
    });

    // If session expired, re-login once and retry
    if (response.status === 401) {
      await login();
      response = await fetch(targetUrl, {
        headers: { Cookie: sessionCookie || '' }
      });
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await response.json();
      return res.status(response.status).json(data);
    } else {
      const text = await response.text();
      return res.status(response.status).send(text);
    }
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: 'Proxy request failed', details: error.message });
  }
}

app.use('/api/v1', proxyRequest);
app.use('/proxy', proxyRequest);

app.get('/', (req, res) => {
  res.json({ status: 'Mite CORS Proxy is running' });
});

app.listen(PORT, () => {
  console.log(`CORS proxy running on port ${PORT}`);
});
