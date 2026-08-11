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

const PRODUCT_PRICES = {
  access:  4900,
  system:  9700,
  control: 19700,
};

const PRODUCT_LABELS = {
  access:  'WinOnAny — Starter',
  system:  'WinOnAny — The Vault',
  control: 'WinOnAny — Full Access',
};

const PRODUCT_VARIATION_IDS = {
  access:  process.env.PRODUCT_ID_ACCESS,
  system:  process.env.PRODUCT_ID_SYSTEM,
  control: process.env.PRODUCT_ID_CONTROL,
};

async function createCheckoutSession(tier, idempotencyKey, successSlug) {
  const { checkoutApi } = client;
  const variationId = PRODUCT_VARIATION_IDS[tier];
  if (!variationId) throw new Error('Unknown product tier: ' + tier);
  const redirectUrl = process.env.APP_URL + '/s/' + successSlug;
  const response = await checkoutApi.createPaymentLink({
    idempotencyKey,
    order: { locationId: process.env.SQUARE_LOCATION_ID, lineItems: [{ quantity: '1', catalogObjectId: variationId, itemType: 'ITEM' }] },
    checkoutOptions: { redirectUrl, askForShippingAddress: false, acceptedPaymentMethods: { applePay: true, googlePay: true, cashAppPay: true }, enableCoupon: false, enableLoyalty: false },
    paymentNote: PRODUCT_LABELS[tier],
  });
  if (response.result.errors && response.result.errors.length > 0) {
    const err = response.result.errors[0];
    throw new Error('Square error: ' + err.code + ' — ' + err.detail);
  }
  const link = response.result.paymentLink;
  return { url: link.url, checkoutId: link.id, orderId: link.orderId, successSlug };
}

function verifyWebhookSignature(body, signature, url) {
  const key  = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
  const hash = crypto.createHmac('sha256', key).update(url + body).digest('base64');
  return hash === signature;
}

module.exports = { client, createCheckoutSession, verifyWebhookSignature, PRODUCT_PRICES, PRODUCT_LABELS };
