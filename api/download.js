'use strict';

const express = require('express');
const path    = require('path');
const fs      = require('fs');
const { getOrderByToken, isTokenValid, recordDownload } = require('../lib/tokens');
const { requireAuth } = require('../lib/auth');
const db = require('../lib/db');

const router = express.Router();

// PDF file map — files live in /pdfs/ folder in the repo
const PDF_FILES = {
  access:  'winonany-starter.pdf',
  system:  'winonany-vault.pdf',
  control: 'winonany-fullaccess.pdf',
};

// ── GET /api/download?token=xxx ───────────────────────────────────────────────
// Used from the success page — token-gated, expires after 48hrs
router.get('/download', async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).send('Missing token.');

    const order = await getOrderByToken(token);
    if (!order) return res.status(404).sendFile(path.join(__dirname, '../public/expired.html'));
    if (!isTokenValid(order)) return res.status(410).sendFile(path.join(__dirname, '../public/expired.html'));

    const filename = PDF_FILES[order.tier];
    if (!filename) return res.status(404).send('File not found.');

    const filePath = path.join(__dirname, '../pdfs', filename);
    if (!fs.existsSync(filePath)) {
      console.error('[download] PDF not found at', filePath);
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

// ── GET /api/download/account ─────────────────────────────────────────────────
// Used from the member portal — JWT-gated, permanent access
router.get('/download/account', requireAuth, async (req, res) => {
  try {
    const { tier } = req.user;
    const { file } = req.query; // 'access' | 'system' | 'control'

    // Users can only download files at or below their tier
    const tierRank = { access: 1, system: 2, control: 3 };
    const requestedRank = tierRank[file];
    const userRank      = tierRank[tier];

    if (!requestedRank || requestedRank > userRank) {
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
