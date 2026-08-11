'use strict';

const crypto = require('crypto');
const db     = require('./db');

const EXPIRY_HOURS = parseInt(process.env.DOWNLOAD_EXPIRY_HOURS || '48', 10);

/**
 * Generate a secure random download token and store it against an order.
 * Called immediately after Square payment.completed webhook fires.
 */
async function createDownloadToken(squareOrderId, tier, buyerEmail, amountCents, squarePaymentId) {
  const token     = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + EXPIRY_HOURS * 60 * 60 * 1000);

  const result = await db.query(
    `INSERT INTO orders
       (square_order_id, square_payment_id, tier, buyer_email, amount_cents, download_token, token_expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (square_order_id) DO NOTHING
     RETURNING *`,
    [squareOrderId, squarePaymentId, tier, buyerEmail, amountCents, token, expiresAt]
  );

  return result.rows[0] || null;
}

/**
 * Look up an order by its download token.
 * Returns the order row or null if not found / expired.
 */
async function getOrderByToken(token) {
  const result = await db.query(
    `SELECT * FROM orders WHERE download_token = $1`,
    [token]
  );
  return result.rows[0] || null;
}

/**
 * Look up an order by its success slug.
 * The slug is a short random string embedded in the redirect URL
 * so the success page URL is not guessable or reusable.
 */
async function getOrderBySlug(slug) {
  const result = await db.query(
    `SELECT * FROM orders WHERE success_slug = $1`,
    [slug]
  );
  return result.rows[0] || null;
}

/**
 * Attach a success slug to an existing order once payment completes.
 * Returns the updated order row.
 */
async function attachSuccessSlug(squareOrderId) {
  const slug = crypto.randomBytes(18).toString('base64url'); // ~24 char URL-safe string
  const result = await db.query(
    `UPDATE orders SET success_slug = $1 WHERE square_order_id = $2 RETURNING *`,
    [slug, squareOrderId]
  );
  return result.rows[0] || null;
}

/**
 * Check if a token is still within its expiry window.
 */
function isTokenValid(order) {
  if (!order) return false;
  return new Date(order.token_expires_at) > new Date();
}

/**
 * Increment the download counter for an order.
 */
async function recordDownload(orderId) {
  await db.query(
    `UPDATE orders SET download_count = download_count + 1 WHERE id = $1`,
    [orderId]
  );
}

module.exports = {
  createDownloadToken,
  getOrderByToken,
  getOrderBySlug,
  attachSuccessSlug,
  isTokenValid,
  recordDownload,
  EXPIRY_HOURS,
};
