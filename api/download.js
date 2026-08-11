'use strict';

const express = require('express');
const path    = require('path');
const fs      = require('fs');
const { getOrderByToken, isTokenValid, recordDownload } = require('../lib/tokens');
const { requireAuth } = require('../lib/auth');

const router = express.Router();

// PDFs live in /pdfs/ at the repo root — NOT in /public/
// Files in /public/ are served openly by express.static. /pdfs/ is private.
const PDF_FILES = {
  access:  'winonany-starter.pdf',
  system:  'winonany-vault.pdf',
  control: 'winonany-fullaccess.pdf',
};

// Tier rank — higher tiers include lower-tier files
const TIER_RANK = { access: 1, system: 2, control: 3 };

// ── GET /api/download?token=xxx[&file=access|system|control] ──────────────────
// Token-gated. Expires after 48hrs (DOWNLOAD_EXPIRY_HOURS).
// 'file' param lets higher-tier buyers download any file at or below their tier.
// Defaults to their purchased tier if 'file' is omitted.
router.get('/download', async (req, res) => {
  try {
    const { token, file } = req.query;

    if (!token) return res.status(400).send('Missing token.');

    const order = await getOrderByToken(token);
    if (!order)              return res.status(404).sendFile(path.join(__dirname, '../public/expired.html'));
    if (!isTokenValid(order)) return res.status(410).sendFile(path.join(__dirname, '../public/expired.html'));

    // Determine which file to serve
    const requestedTier = file || order.tier;

    if (!PDF_FILES[requestedTier]) {
      return res.status(400).send('Unknown file.');
    }

    // Enforce tier access — can only download files at or below purchased tier
    if (TIER_RANK[requestedTier] > TIER_RANK[order.tier]) {
      return res.status(403).send('Your tier does not include this file.');
    }

    const filename = PDF_FILES[requestedTier];
    const filePath = path.join(__dirname, '../pdfs', filename);

    if (!fs.existsSync(filePath)) {
      console.error('[download] PDF missing:', filePath);
      return res.status(503).send('File temporarily unavailable. Contact support.');
    }

    await recordDownload(order.id);

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/pdf');
    return res.sendFile(filePath);

  } catch (err) {
    console.error('[download] error:', err.message);
    return res.status(500).send('Download failed.');
  }
});

// ── GET /api/download/account?file=access|system|control ─────────────────────
// JWT-gated — used from the member portal for permanent re-downloads.
router.get('/download/account', requireAuth, async (req, res) => {
  try {
    const { tier } = req.user;
    const { file } = req.query;

    if (!file || !PDF_FILES[file]) {
      return res.status(400).json({ error: 'Missing or unknown file.' });
    }

    if (TIER_RANK[file] > TIER_RANK[tier]) {
      return res.status(403).json({ error: 'Your tier does not include this file.' });
    }

    const filename = PDF_FILES[file];
    const filePath = path.join(__dirname, '../pdfs', filename);

    if (!fs.existsSync(filePath)) {
      return res.status(503).send('File temporarily unavailable. Contact support.');
    }

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/pdf');
    return res.sendFile(filePath);

  } catch (err) {
    console.error('[download/account] error:', err.message);
    return res.status(500).send('Download failed.');
  }
});

module.exports = router;
