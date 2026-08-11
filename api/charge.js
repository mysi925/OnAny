'use strict';

const express  = require('express');
const { v4: uuidv4 } = require('uuid');
const { client, PRODUCT_PRICES, PRODUCT_LABELS } = require('../lib/square');
const { createDownloadToken, attachSuccessSlug } = require('../lib/tokens');
const { sendDownloadEmail } = require('../lib/email');

const router  = express.Router();
const { paymentsApi } = client;

const VALID_TIERS = new Set(['access', 'system', 'control']);

/**
 * POST /api/charge
 *
 * Body: { sourceId: string, tier: 'access' | 'system' | 'control' }
 *
 * Square Web Payments SDK tokenizes the card on the frontend.
 * We charge it here server-side — card data never touches this server.
 * On success we create a download token + randomized success slug,
 * send the buyer their download email, and return the slug URL
 * so the frontend can redirect to winonany.com/s/:slug.
 */
router.post('/charge', async (req, res) => {
  const { sourceId, tier } = req.body;

  if (!sourceId || typeof sourceId !== 'string') {
    return res.status(400).json({ error: 'Missing sourceId.' });
  }

  if (!tier || !VALID_TIERS.has(tier)) {
    return res.status(400).json({ error: 'Invalid tier.' });
  }

  const price = PRODUCT_PRICES[tier];
  const label = PRODUCT_LABELS[tier];

  try {
    // ── 1. Charge the card via Square ────────────────────────────────────────
    const idempotencyKey = uuidv4();

    const { result } = await paymentsApi.createPayment({
      sourceId,
      idempotencyKey,
      amountMoney: {
        amount:   BigInt(price),
        currency: 'USD',
      },
      locationId: process.env.SQUARE_LOCATION_ID,
      note:       label,
      buyerEmailAddress: req.body.email || undefined,
    });

    if (result.errors && result.errors.length > 0) {
      const e = result.errors[0];
      console.error('[charge] Square error:', e.code, e.detail);
      return res.status(402).json({ error: e.detail || 'Payment declined.' });
    }

    const payment    = result.payment;
    const squareOrderId = payment.orderId || payment.id; // orderId may be absent for direct charges
    const buyerEmail = payment.buyerEmailAddress || req.body.email || null;

    console.log('[charge] success — id:', payment.id, 'tier:', tier, 'amount:', price);

    // ── 2. Create expiring download token in DB ───────────────────────────────
    const order = await createDownloadToken(
      squareOrderId,
      tier,
      buyerEmail,
      price,
      payment.id
    );

    // ── 3. Attach unique success slug ─────────────────────────────────────────
    const updated    = order ? await attachSuccessSlug(squareOrderId) : null;
    const slug       = updated ? updated.success_slug : null;
    const successUrl = slug
      ? `${process.env.APP_URL}/s/${slug}`
      : `${process.env.APP_URL}/success?tier=${tier}`;

    // ── 4. Send download email ────────────────────────────────────────────────
    if (order && buyerEmail) {
      try {
        await sendDownloadEmail(buyerEmail, tier, order.download_token, successUrl);
        console.log('[charge] email sent →', buyerEmail);
      } catch (emailErr) {
        // Don't fail the charge if email fails — log it
        console.error('[charge] email failed:', emailErr.message);
      }
    }

    // ── 5. Discord notification ───────────────────────────────────────────────
    await notifyDiscord({ tier, amountCents: price, buyerEmail, orderId: squareOrderId });

    // ── 6. Return slug URL to frontend for redirect ───────────────────────────
    return res.json({ success: true, paymentId: payment.id, redirectUrl: successUrl });

  } catch (err) {
    // Square SDK surfaces declined cards as thrown errors
    const squareErrors = err?.result?.errors;
    if (squareErrors && squareErrors.length > 0) {
      const e = squareErrors[0];
      console.error('[charge] declined:', e.code, e.detail);
      return res.status(402).json({ error: e.detail || 'Payment declined.' });
    }
    console.error('[charge] unexpected error:', err.message);
    return res.status(500).json({ error: 'Payment failed — try again.' });
  }
});

// ── Discord notification ──────────────────────────────────────────────────────
async function notifyDiscord({ tier, amountCents, buyerEmail, orderId, failed = false }) {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) return;
  const tierLabel = tier ? PRODUCT_LABELS[tier] : 'Unknown';
  const amount    = `$${(amountCents / 100).toFixed(2)}`;
  const embed = failed
    ? { title: '❌ Payment Failed', color: 0xef4444, fields: [{ name: 'Order', value: orderId || '—', inline: true }], timestamp: new Date().toISOString() }
    : { title: '💸 New Payment', color: 0x6E56F8, fields: [
        { name: 'Tier',   value: tierLabel,         inline: true },
        { name: 'Amount', value: amount,            inline: true },
        { name: 'Email',  value: buyerEmail || '—', inline: true },
        { name: 'Order',  value: `\`${orderId}\``,  inline: false },
      ], timestamp: new Date().toISOString() };
  try {
    await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ embeds: [embed] }) });
  } catch (e) {
    console.warn('[charge] Discord notify failed:', e.message);
  }
}

module.exports = router;
