'use strict';

const express  = require('express');
const { v4: uuidv4 } = require('uuid');
const crypto   = require('crypto');
const { createCheckoutSession } = require('../lib/square');

const router = express.Router();
const VALID_TIERS = new Set(['access', 'system', 'control']);

/**
 * POST /api/checkout
 * Body: { tier: 'access' | 'system' | 'control' }
 * Returns: { url } — client redirects to Square hosted checkout
 *
 * A unique success slug is pre-generated here and embedded in the
 * Square redirect URL so winonany.com/s/:slug is different every time.
 */
router.post('/checkout', async (req, res) => {
  try {
    const { tier } = req.body;
    if (!tier || !VALID_TIERS.has(tier)) {
      return res.status(400).json({ error: 'Invalid or missing tier.' });
    }

    const idempotencyKey = uuidv4();
    // Pre-generate the success slug — Square will redirect here after payment
    const successSlug    = crypto.randomBytes(18).toString('base64url');

    const session = await createCheckoutSession(tier, idempotencyKey, successSlug);

    return res.json({ url: session.url });
  } catch (err) {
    console.error('[checkout] error:', err.message);
    return res.status(500).json({ error: 'Failed to create checkout session.' });
  }
});

module.exports = router;
