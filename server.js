'use strict';
require('dotenv').config();

const express      = require('express');
const path         = require('path');
const fs           = require('fs');
const cookieParser = require('cookie-parser');

const chargeRoute   = require('./api/charge');
const webhookRoute  = require('./api/webhook');
const authRoute     = require('./api/auth');
const downloadRoute = require('./api/download');
const { getOrderBySlug, isTokenValid } = require('./lib/tokens');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Body parsing ───────────────────────────────────────────────────────────────
app.use(cookieParser());
app.use('/api/webhook', express.raw({ type: 'application/json' }));
app.use('/api', express.json());

// ── Security headers ───────────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// ── Public Square config ───────────────────────────────────────────────────────
app.get('/api/config', (req, res) => {
  res.json({
    squareAppId:      process.env.SQUARE_APP_ID      || '',
    squareLocationId: process.env.SQUARE_LOCATION_ID || '',
    environment:      process.env.SQUARE_ENVIRONMENT || 'sandbox',
  });
});

// ── API routes ─────────────────────────────────────────────────────────────────
app.use('/api', chargeRoute);
app.use('/api', webhookRoute);
app.use('/api', authRoute);
app.use('/api', downloadRoute);

// ── Static assets (css, fonts, images, pdfs) ──────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ── Page routes ────────────────────────────────────────────────────────────────
const page = (file) => (req, res) =>
  res.sendFile(path.join(__dirname, 'public', file));

app.get('/',        (req, res) => res.redirect(302, process.env.MARKETING_URL || 'https://winonany.com'));
app.get('/pay',     page('pay.html'));
app.get('/login',   page('login.html'));
app.get('/portal',  page('portal.html'));
app.get('/expired', page('expired.html'));

// ── Secure success route ───────────────────────────────────────────────────────
// Randomised slug prevents direct access — token validated on every request.
app.get('/s/:slug', async (req, res) => {
  try {
    const order = await getOrderBySlug(req.params.slug);

    if (!order || !isTokenValid(order)) {
      return res.sendFile(path.join(__dirname, 'public/expired.html'));
    }

    const html = fs.readFileSync(
      path.join(__dirname, 'public/success.html'),
      'utf8'
    );

    const injection = `<script>
window.__WOA__ = {
  token: ${JSON.stringify(order.download_token)},
  tier:  ${JSON.stringify(order.tier)},
  slug:  ${JSON.stringify(req.params.slug)}
};
</script>`;

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Cache-Control', 'no-store');
    return res.send(html.replace('</head>', injection + '</head>'));

  } catch (err) {
    console.error('[/s/:slug]', err.message);
    return res.sendFile(path.join(__dirname, 'public/expired.html'));
  }
});

// ── 404 ────────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).send('Not found.');
});

// ── Start ──────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`WinOnAny on :${PORT}  [${process.env.SQUARE_ENVIRONMENT || 'sandbox'}]`);
});
