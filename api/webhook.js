'use strict';

const express  = require('express');
const { verifyWebhookSignature } = require('../lib/square');
const { createDownloadToken, attachSuccessSlug } = require('../lib/tokens');
const { sendDownloadEmail } = require('../lib/email');

const router = express.Router();

// ── Tier lookup by Square variation ID ───────────────────────────────────────
function tierFromVariationId(variationId) {
  const map = {
    [process.env.PRODUCT_ID_ACCESS]:  'access',
    [process.env.PRODUCT_ID_SYSTEM]:  'system',
    [process.env.PRODUCT_ID_CONTROL]: 'control',
  };
  return map[variationId] || 'access';
}

// ── Tier lookup by amount (fallback) ─────────────────────────────────────────
const PRODUCT_PRICES = { access: 4900, system: 9700, control: 19700 };
function tierFromAmount(cents) {
  const entry = Object.entries(PRODUCT_PRICES).find(([, v]) => v === cents);
  return entry ? entry[0] : null;
}

// ── Discord notification ──────────────────────────────────────────────────────
const PRODUCT_LABELS = {
  access:  'WinOnAny — Starter',
  system:  'WinOnAny — The Vault',
  control: 'WinOnAny — Full Access',
};

async function notifyDiscord({ tier, amountCents, buyerEmail, orderId, failed = false }) {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) return;

  const tierLabel = tier ? PRODUCT_LABELS[tier] : 'Unknown tier';
  const amount    = `$${(amountCents / 100).toFixed(2)}`;

  const embed = failed
    ? {
        title:  '❌ Payment Failed',
        color:  0xef4444,
        fields: [{ name: 'Order ID', value: orderId || '—', inline: true }],
        timestamp: new Date().toISOString(),
      }
    : {
        title:  '💸 New Payment',
        color:  0x6E56F8,
        fields: [
          { name: 'Tier',     value: tierLabel,         inline: true },
          { name: 'Amount',   value: amount,            inline: true },
          { name: 'Email',    value: buyerEmail || '—', inline: true },
          { name: 'Order ID', value: `\`${orderId}\``,  inline: false },
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

// ── Webhook route ─────────────────────────────────────────────────────────────
router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    try {
      const signature  = req.headers['x-square-hmacsha256-signature'];
      const webhookUrl = `${process.env.APP_URL}/api/webhook`;
      const rawBody    = req.body.toString('utf8');

      if (!verifyWebhookSignature(rawBody, signature, webhookUrl)) {
        console.warn('[webhook] invalid signature');
        return res.status(403).json({ error: 'Invalid signature.' });
      }

      const event = JSON.parse(rawBody);
      console.log('[webhook] ' + event.type);

      if (event.type === 'payment.completed') {
        const payment     = event.data.object.payment;
        const squareOrderId  = payment.orderId;
        const paymentId   = payment.id;
        const buyerEmail  = payment.buyerEmailAddress;
        const amountCents = (payment.totalMoney && payment.totalMoney.amount) || 0;

        // Determine tier — try variation ID first, fall back to amount
        const variationId = payment.lineItemUid || null;
        const tier = variationId
          ? tierFromVariationId(variationId)
          : (tierFromAmount(amountCents) || 'access');

        // Create expiring download token in DB
        const order = await createDownloadToken(
          squareOrderId, tier, buyerEmail, amountCents, paymentId
        );

        if (order) {
          // Attach unique success slug for the randomized redirect URL
          const updated    = await attachSuccessSlug(squareOrderId);
          const slug       = updated ? updated.success_slug : null;
          const successUrl = slug ? `${process.env.APP_URL}/s/${slug}` : null;

          // Send download email with the randomized success URL
          if (buyerEmail && successUrl) {
            await sendDownloadEmail(buyerEmail, tier, order.download_token, successUrl);
            console.log('[webhook] sent access email → ' + buyerEmail + ' slug: ' + slug);
          }
        }

        // Discord notification
        await notifyDiscord({ tier, amountCents, buyerEmail, orderId: squareOrderId });
      }

      if (event.type === 'payment.failed') {
        const payment = event.data.object.payment;
        await notifyDiscord({ orderId: payment.orderId, amountCents: 0, failed: true });
        console.warn('[webhook] payment.failed — order: ' + payment.orderId);
      }

      return res.status(200).json({ received: true });
    } catch (err) {
      console.error('[webhook] error:', err.message);
      return res.status(500).json({ error: 'Handler failed.' });
    }
  }
);

module.exports = router;
