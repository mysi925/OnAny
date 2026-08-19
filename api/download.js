'use strict';

const express = require('express');
const path    = require('path');
const fs      = require('fs');
const { getOrderByToken, isTokenValid, recordDownload } = require('../lib/tokens');

const router = express.Router();

// PDF filenames map to the actual files in /pdfs/ at repo root.
// File names match what's in the uploaded repo: starter_1.pdf, vault.pdf, full.pdf
const PDF_FILES = {
  access:  'starter_1.pdf',
  system:  'vault.pdf',
  control: 'full.pdf',
};

const TIER_RANK = { access: 1, system: 2, control: 3 };

// ── GET /api/download?token=xxx[&file=access|system|control] ──────────────────
// Token-gated. No login required. Token expires after 48hrs.
router.get('/download', async (req, res) => {
  try {
    const { token, file } = req.query;
    if (!token) return res.status(400).send('Missing token.');

    const order = await getOrderByToken(token);
    if (!order)               return res.status(404).sendFile(path.join(__dirname, '../public/expired.html'));
    if (!isTokenValid(order)) return res.status(410).sendFile(path.join(__dirname, '../public/expired.html'));

    const requestedTier = file || order.tier;
    if (!PDF_FILES[requestedTier])
      return res.status(400).send('Unknown file.');

    if (TIER_RANK[requestedTier] > TIER_RANK[order.tier])
      return res.status(403).send('Your tier does not include this file.');

    const filename = PDF_FILES[requestedTier];
    const filePath = path.join(__dirname, '../pdfs', filename);

    if (!fs.existsSync(filePath)) {
      console.error('[download] PDF missing:', filePath);
      return res.status(503).send('File temporarily unavailable. DM @cynski on Telegram for help.');
    }

    await recordDownload(order.id);

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/pdf');
    return res.sendFile(filePath);

  } catch (err) {
    console.error('[download]', err.message);
    return res.status(500).send('Download failed.');
  }
});

// /api/download/account route REMOVED — login gate stripped.
// All downloads go through token-gated /api/download?token=xxx only.

module.exports = router;
