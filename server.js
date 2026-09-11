const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Proxy all API requests
app.use('/api/v1', async (req, res) => {
  try {
    const targetUrl = `https://yattee-server-production-1d73.up.railway.app/api/v1${req.url}`;
    
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mite-Proxy/1.0'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: 'Proxy request failed', details: error.message });
  }
});

app.get('/', (req, res) => {
  res.json({ status: 'Mite CORS Proxy is running' });
});

app.listen(PORT, () => {
  console.log(`CORS proxy running on port ${PORT}`);
});
