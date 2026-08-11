'use strict';

const { Client, Environment } = require('square');
const crypto = require('crypto');

const client = new Client({
  accessToken: process.env.SQUARE_ACCESS_TOKEN,
  environment:
    process.env.SQUARE_ENVIRONMENT === 'production'
      ? Environment.Production
      : Environment.Sandbox,
});

// ── Prices in cents — must match what pay.html displays ──────────────────────
const PRODUCT_PRICES = {
  access:  2999,   // $29.99
  system:  5999,   // $59.99
  control: 9999,   // $99.99
};

const PRODUCT_LABELS = {
  access:  'WinOnAny — Starter',
  system:  'WinOnAny — The Vault',
  control: 'WinOnAny — Full Access',
};

function verifyWebhookSignature(body, signature, url) {
  const key  = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
  if (!key) return false;
  const hash = crypto.createHmac('sha256', key).update(url + body).digest('base64');
  return hash === signature;
}

module.exports = { client, verifyWebhookSignature, PRODUCT_PRICES, PRODUCT_LABELS };
