const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8080;
const YATTEE_URL = 'https://yattee-server-production-1d73.up.railway.app';

app.use(cors());
app.use(express.json());

let sessionCookie = '';

// Function to log into Yattee and store the cookie
async function performLogin() {
    console.log('Attempting login to Yattee...');
    try {
        const response = await fetch(`${YATTEE_URL}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: process.env.YATTEE_USER,
                password: process.env.YATTEE_PASS
            })
        });

        if (!response.ok) throw new Error(`Login failed with status ${response.status}`);

        const setCookie = response.headers.get('set-cookie');
        if (setCookie) {
            sessionCookie = setCookie.split(';')[0];
            console.log('Successfully logged in and stored session cookie.');
            return true;
        }
        return false;
    } catch (error) {
        console.error('Login error:', error.message);
        return false;
    }
}

// Universal Proxy Handler
app.use(['/api/v1/*', '/proxy/*'], async (req, res) => {
    try {
        // 1. If no cookie, login first
        if (!sessionCookie) {
            const success = await performLogin();
            if (!success) return res.status(401).json({ error: "Proxy could not authenticate with Yattee" });
        }

        const targetUrl = `${YATTEE_URL}${req.originalUrl}`;
        console.log(`Forwarding request: ${targetUrl}`);

        // 2. Make the request with the session cookie
        let response = await fetch(targetUrl, {
            method: req.method,
            headers: {
                'Cookie': sessionCookie,
                'Accept': 'application/json'
            }
        });

        // 3. If session expired (401), try to re-login once
        if (response.status === 401) {
            console.log('Session expired, retrying login...');
            await performLogin();
            response = await fetch(targetUrl, {
                method: req.method,
                headers: { 'Cookie': sessionCookie }
            });
        }

        // 4. Return the data to your frontend
        const data = await response.json();
        res.status(response.status).json(data);

    } catch (error) {
        console.error('Proxy Error:', error);
        res.status(500).json({ error: "Proxy internal error", details: error.message });
    }
});

app.get('/', (req, res) => res.send({ status: "Mite Proxy Online", authenticated: !!sessionCookie }));

app.listen(PORT, () => console.log(`Proxy running on port ${PORT}`));
