const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all routes
app.use(cors());

// Proxy all requests to yattee-server
app.use('/api', async (req, res) => {
  try {
    const targetUrl = `https://yattee-server-production-1d73.up.railway.app${req.url}`;
    
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mite-Proxy/1.0'
      }
    });
    
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: 'Proxy request failed' });
  }
});

app.listen(PORT, () => {
  console.log(`CORS proxy running on port ${PORT}`);
});
