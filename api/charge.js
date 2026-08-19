'use strict';

// ══════════════════════════════════════════════════════════════════════════════
// PRIVACY NOTE: This file runs on winonany.win ONLY.
// The success URL returned in redirectUrl points to /s/:slug on the SAME domain
// (winonany.win). winonany.com is NEVER referenced here. Square sees only
// winonany.win. No cross-domain leak. No Referer header (server.js sets
// Referrer-Policy: no-referrer globally).
// ══════════════════════════════════════════════════════════════════════════════

const express  = require('express');
const { v4: uuidv4 } = require('uuid');
const { client, PRODUCT_PRICES, PRODUCT_LABELS } = require('../lib/square');
const { createDownloadToken, attachSuccessSlug } = require('../lib/tokens');

const router  = express.Router();
const { paymentsApi } = client;

const VALID_TIERS = new Set(['access', 'system', 'control']);

router.post('/charge', async (req, res) => {
  const { sourceId, tier, email, promoCode } = req.body;

  if (!sourceId || typeof sourceId !== 'string')
    return res.status(400).json({ error: 'Missing sourceId.' });

  if (!tier || !VALID_TIERS.has(tier))
    return res.status(400).json({ error: 'Invalid tier.' });

  const PROMO_DISCOUNTS = { WIN: 0.85 };
  let price = PRODUCT_PRICES[tier];
  if (promoCode && typeof promoCode === 'string') {
    const mult = PROMO_DISCOUNTS[promoCode.toUpperCase()];
    if (mult) price = Math.round(price * mult);
  }
  const label = PRODUCT_LABELS[tier];

  try {
    const { result } = await paymentsApi.createPayment({
      sourceId,
      idempotencyKey: uuidv4(),
      amountMoney:    { amount: BigInt(price), currency: 'USD' },
      locationId:     process.env.SQUARE_LOCATION_ID,
      note:           label,
      buyerEmailAddress: email || undefined,
    });

    if (result.errors && result.errors.length > 0) {
      const e = result.errors[0];
      console.error('[charge] Square error:', e.code, e.detail);
      return res.status(402).json({ error: e.detail || 'Payment declined.' });
    }

    const payment       = result.payment;
    const squareOrderId = payment.orderId || payment.id;
    const buyerEmail    = payment.buyerEmailAddress || email || null;

    console.log('[charge] ok — id:', payment.id, 'tier:', tier);

    const order   = await createDownloadToken(squareOrderId, tier, buyerEmail, price, payment.id);
    const updated = order ? await attachSuccessSlug(squareOrderId) : null;
    const slug    = updated ? updated.success_slug : null;

    // ── Success URL stays on winonany.win — no redirect to winonany.com ──
    // /s/:slug serves success.html with the download token injected server-side.
    const successUrl = slug
      ? `/s/${slug}`
      : `/success?tier=${tier}`;

    await notifyDiscord({ tier, amountCents: price, buyerEmail, orderId: squareOrderId });

    return res.json({ success: true, paymentId: payment.id, redirectUrl: successUrl });

  } catch (err) {
    const sqErrs = err?.result?.errors;
    if (sqErrs && sqErrs.length > 0) {
      const e = sqErrs[0];
      console.error('[charge] declined:', e.code, e.detail);
      return res.status(402).json({ error: e.detail || 'Payment declined.' });
    }
    console.error('[charge] unexpected:', err.message);
    return res.status(500).json({ error: 'Payment failed — try again.' });
  }
});

async function notifyDiscord({ tier, amountCents, buyerEmail, orderId }) {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [{
          title: '💸 New Payment',
          color: 0x6E56F8,
          fields: [
            { name: 'Tier',   value: PRODUCT_LABELS[tier] || tier, inline: true },
            { name: 'Amount', value: '$' + (amountCents / 100).toFixed(2), inline: true },
            { name: 'Email',  value: buyerEmail || '—', inline: true },
            { name: 'Order',  value: '`' + orderId + '`', inline: false },
          ],
          timestamp: new Date().toISOString(),
        }],
      }),
    });
  } catch (e) {
    console.warn('[charge] Discord notify failed:', e.message);
  }
}

module.exports = router;
