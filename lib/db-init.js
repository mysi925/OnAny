'use strict';

require('dotenv').config();
const db = require('./db');

async function init() {
  console.log('[db-init] creating tables...');

  // FIX: tier is nullable — no DEFAULT, no NOT NULL.
  // The old schema had tier TEXT NOT NULL CHECK (tier IN ('access','system','control'))
  // but api/auth.js was inserting tier='none', which the CHECK rejected with error 23514.
  // New users have tier=NULL until they purchase; the portal handles null gracefully.
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email         TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      tier          TEXT CHECK (tier IN ('access', 'system', 'control')),
      created_at    TIMESTAMPTZ DEFAULT NOW(),
      last_login_at TIMESTAMPTZ
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      square_order_id   TEXT UNIQUE NOT NULL,
      square_payment_id TEXT,
      tier              TEXT NOT NULL CHECK (tier IN ('access', 'system', 'control')),
      buyer_email       TEXT,
      amount_cents      INTEGER,
      paid_at           TIMESTAMPTZ DEFAULT NOW(),
      download_token    TEXT UNIQUE NOT NULL,
      token_expires_at  TIMESTAMPTZ NOT NULL,
      download_count    INTEGER DEFAULT 0,
      success_slug      TEXT UNIQUE,
      user_id           UUID REFERENCES users(id) ON DELETE SET NULL
    );
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_orders_token        ON orders(download_token);
    CREATE INDEX IF NOT EXISTS idx_orders_slug         ON orders(success_slug);
    CREATE INDEX IF NOT EXISTS idx_orders_square_order ON orders(square_order_id);
    CREATE INDEX IF NOT EXISTS idx_users_email         ON users(email);
  `);

  console.log('[db-init] done.');
  process.exit(0);
}

init().catch((err) => {
  console.error('[db-init] failed:', err.message);
  process.exit(1);
});
