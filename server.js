'use strict';

require('dotenv').config();

const express       = require('express');
const path          = require('path');
const fs            = require('fs');
const cookieParser  = require('cookie-parser');
const chargeRoute   = require('./api/charge');
const checkoutRoute = require('./api/checkout');
const webhookRoute  = require('./api/webhook');
const authRoute     = require('./api/auth');
const downloadRoute = require('./api/download');
const { getOrderBySlug, isTokenValid } = require('./lib/tokens');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Cookie parser ─────────────────────────────────────────────────────────────
app.use(cookieParser());

// ── Raw body for webhook ──────────────────────────────────────────────────────
app.use('/api/webhook', express.raw({ type: 'application/json' }));

// ── JSON for all other API routes ─────────────────────────────────────────────
app.use('/api', express.json());

// ── Security headers ──────────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// ── winonany.win — serve checkout page for ALL requests ───────────────────────
app.use((req, res, next) => {
  const host = (req.headers.host || '').toLowerCase();
  if (host.includes('winonany.win')) {
    // API calls from pay.html still need to work
    if (req.path.startsWith('/api/')) return next();
    return res.sendFile(path.join(__dirname, 'public/pay.html'));
  }
  next();
});

// ── Public Square config ──────────────────────────────────────────────────────
app.get('/api/config', (req, res) => {
  res.json({
    squareAppId:      process.env.SQUARE_APP_ID      || '',
    squareLocationId: process.env.SQUARE_LOCATION_ID || '',
    environment:      process.env.SQUARE_ENVIRONMENT || 'sandbox',
  });
});

// ── API routes ────────────────────────────────────────────────────────────────
app.use('/api', chargeRoute);
app.use('/api', checkoutRoute);
app.use('/api', webhookRoute);
app.use('/api', authRoute);
app.use('/api', downloadRoute);

// ── Static files ──────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ── Named page routes ─────────────────────────────────────────────────────────
app.get('/pay',     (req, res) => res.sendFile(path.join(__dirname, 'public/pay.html')));
app.get('/login',   (req, res) => res.sendFile(path.join(__dirname, 'public/login.html')));
app.get('/portal',  (req, res) => res.sendFile(path.join(__dirname, 'public/portal.html')));
app.get('/expired', (req, res) => res.sendFile(path.join(__dirname, 'public/expired.html')));

// ── Randomized success route /s/:slug ─────────────────────────────────────────
app.get('/s/:slug', async (req, res) => {
  try {
    const order = await getOrderBySlug(req.params.slug);
    if (!order || !isTokenValid(order)) {
      return res.sendFile(path.join(__dirname, 'public/expired.html'));
    }
    const html      = fs.readFileSync(path.join(__dirname, 'public/success.html'), 'utf8');
    const injection = `<script>
window.__WOA__ = {
  token: ${JSON.stringify(order.download_token)},
  tier:  ${JSON.stringify(order.tier)},
  slug:  ${JSON.stringify(req.params.slug)}
};
</script>`;
    const injected = html.replace('</head>', injection + '</head>');
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Cache-Control', 'no-store');
    return res.send(injected);
  } catch (err) {
    console.error('[/s/:slug] error:', err.message);
    return res.sendFile(path.join(__dirname, 'public/expired.html'));
  }
});

// ── SPA fallback (winonany.com only) ─────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

app.listen(PORT, () => {
  console.log('WinOnAny running on port ' + PORT);
  console.log('Square environment: ' + (process.env.SQUARE_ENVIRONMENT || 'sandbox'));
});
