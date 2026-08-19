'use strict';
require('dotenv').config();

const express = require('express');
const path    = require('path');
const fs      = require('fs');

// ══════════════════════════════════════════════════════════════════════════════
// DOMAIN ARCHITECTURE — DO NOT CHANGE REDIRECT BEHAVIOUR WITHOUT READING THIS
//
// winonany.win  = CHECKOUT ONLY. Serves: pay.html, success.html, expired.html,
//                 /api/charge, /api/download, /api/config, Square SDK.
//                 NEVER redirects to winonany.com. NEVER leaks Referer.
//
// winonany.com  = MARKETING ONLY. Serves: index.html only.
//                 NEVER handles payments. NEVER touches Square.
//
// Both domains hit this same Railway process, routed by req.hostname.
// The login gate has been REMOVED — no /login, /portal, /api/auth routes.
// After payment, users stay on winonany.win for download. No cross-domain jump.
// Square only ever sees requests originating from winonany.win.
// ══════════════════════════════════════════════════════════════════════════════

const chargeRoute   = require('./api/charge');
const webhookRoute  = require('./api/webhook');
const downloadRoute = require('./api/download');
const { getOrderBySlug, isTokenValid } = require('./lib/tokens');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Body parsing ───────────────────────────────────────────────────────────────
app.use('/api/webhook', express.raw({ type: 'application/json' }));
app.use('/api', express.json());

// ── Security / privacy headers ─────────────────────────────────────────────────
// Referrer-Policy: no-referrer — Square (and any third party) sees NO referrer
// header from winonany.win requests. Zero leakage of winonany.com URL or path.
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'payment=*');
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
app.use('/api', downloadRoute);
// auth routes REMOVED — no login gate

// ── Apple Pay domain verification ─────────────────────────────────────────────
app.get('/.well-known/apple-developer-merchantid-domain-association', (req, res) => {
  try {
    const raw     = fs.readFileSync(
      path.join(__dirname, 'public/.well-known/apple-developer-merchantid-domain-association')
    );
    const payload = Buffer.from(raw.toString('binary').replace(/\s+$/, ''), 'binary');
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', payload.length);
    res.end(payload);
  } catch (err) {
    console.error('[apple-pay] domain association file missing:', err.message);
    res.status(500).end();
  }
});

// ── Page routes ────────────────────────────────────────────────────────────────
const page = (file) => (req, res) =>
  res.sendFile(path.join(__dirname, 'public', file));

app.get('/', (req, res) => {
  if (req.hostname === 'winonany.com' || req.hostname === 'www.winonany.com') {
    return res.sendFile(path.join(__dirname, 'public/index.html'));
  }
  // winonany.win and Railway preview URLs → checkout
  return res.redirect(302, '/pay?tier=system');
});

app.get('/pay',     page('pay.html'));
app.get('/expired', page('expired.html'));
app.get('/contact', page('contact.html'));
app.get('/terms',   page('terms.html'));
app.get('/privacy', page('privacy.html'));

// Login/portal routes REMOVED — no login gate

// ── Static assets ──────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public'), { dotfiles: 'allow', index: false }));

// ── Success route — stays on winonany.win, no cross-domain jump ────────────────
// /s/:slug validates the token server-side and injects it into success.html.
// The entire download flow completes on .win — winonany.com is never referenced.
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
app.use((req, res) => res.status(404).send('Not found.'));

// ── Start ──────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`WinOnAny :${PORT}  [${process.env.SQUARE_ENVIRONMENT || 'sandbox'}]`);
});
