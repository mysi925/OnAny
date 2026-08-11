'use strict';

const express  = require('express');
const { verifyWebhookSignature, PRODUCT_LABELS, PRODUCT_PRICES } = require('../lib/square');
const { createDownloadToken, attachSuccessSlug } = require('../lib/tokens');

const router = express.Router();

// NOTE: express.raw() for /api/webhook is already applied in server.js.
// Do NOT add it again here — double-parsing corrupts the body.

function tierFromAmount(cents) {
  const entry = Object.entries(PRODUCT_PRICES).find(([, v]) => v === cents);
  return entry ? entry[0] : null;
}

async function notifyDiscord({ tier, amountCents, buyerEmail, orderId, failed = false }) {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) return;
  const embed = failed
    ? {
        title:  '❌ Payment Failed',
        color:  0xef4444,
        fields: [{ name: 'Order', value: orderId || '—', inline: true }],
        timestamp: new Date().toISOString(),
      }
    : {
        title:  '💸 New Payment',
        color:  0x6E56F8,
        fields: [
          { name: 'Tier',   value: PRODUCT_LABELS[tier] || tier, inline: true },
          { name: 'Amount', value: '$' + (amountCents / 100).toFixed(2), inline: true },
          { name: 'Email',  value: buyerEmail || '—', inline: true },
          { name: 'Order',  value: '`' + orderId + '`', inline: false },
        ],
        timestamp: new Date().toISOString(),
      };
  try {
    await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ embeds: [embed] }),
    });
  } catch (e) {
    console.warn('[webhook] Discord notify failed:', e.message);
  }
}

/**
 * POST /api/webhook
 * Safety net for payments that don't go through /api/charge
 * (e.g. direct Square links, retry scenarios).
 * /api/charge already handles the primary embedded-checkout flow.
 */
router.post('/webhook', async (req, res) => {
  try {
    const signature  = req.headers['x-square-hmacsha256-signature'];
    const webhookUrl = `${process.env.APP_URL}/api/webhook`;
    const rawBody    = req.body.toString('utf8');

    if (!verifyWebhookSignature(rawBody, signature, webhookUrl)) {
      console.warn('[webhook] invalid signature');
      return res.status(403).json({ error: 'Invalid signature.' });
    }

    const event = JSON.parse(rawBody);
    console.log('[webhook]', event.type);

    if (event.type === 'payment.completed') {
      const payment       = event.data.object.payment;
      const squareOrderId = payment.orderId;
      const paymentId     = payment.id;
      const buyerEmail    = payment.buyerEmailAddress || null;
      const amountCents   = payment.totalMoney?.amount || 0;
      const tier          = tierFromAmount(Number(amountCents));

      if (tier) {
        // ON CONFLICT DO NOTHING — safe to call even if /api/charge already ran
        const order = await createDownloadToken(
          squareOrderId, tier, buyerEmail, amountCents, paymentId
        );
        if (order) await attachSuccessSlug(squareOrderId);
      } else {
        console.warn('[webhook] unrecognised amount:', amountCents);
      }

      await notifyDiscord({ tier, amountCents: Number(amountCents), buyerEmail, orderId: squareOrderId });
    }

    if (event.type === 'payment.failed') {
      const payment = event.data.object.payment;
      await notifyDiscord({ orderId: payment.orderId, amountCents: 0, failed: true });
    }

    return res.status(200).json({ received: true });

  } catch (err) {
    console.error('[webhook] error:', err.message);
    return res.status(500).json({ error: 'Handler failed.' });
  }
});

module.exports = router;
