'use strict';

const bcrypt = require('bcrypt');
const jwt    = require('jsonwebtoken');
const db     = require('./db');

const SALT_ROUNDS = 12;
const JWT_SECRET  = process.env.JWT_SECRET;
const JWT_EXPIRY  = '30d';

// ─── Password ─────────────────────────────────────────────────────────────────

async function hashPassword(plain) {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

// ─── JWT ──────────────────────────────────────────────────────────────────────

function signToken(userId, tier) {
  return jwt.sign({ sub: userId, tier }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

// ─── Middleware ───────────────────────────────────────────────────────────────

function requireAuth(req, res, next) {
  const token =
    req.cookies?.woa_token ||
    (req.headers.authorization || '').replace('Bearer ', '');

  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Not authenticated.' });
  }
  req.user = payload;
  next();
}

// ─── User ops ─────────────────────────────────────────────────────────────────

/**
 * Create a new user and link them to an existing order.
 * Only allowed if the order token is still valid (within 48hr window).
 */
async function createUser(email, password, orderId, tier) {
  const hash = await hashPassword(password);

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const userRes = await client.query(
      `INSERT INTO users (email, password_hash, tier)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [email.toLowerCase().trim(), hash, tier]
    );
    const user = userRes.rows[0];

    // Link order to this user
    await client.query(
      `UPDATE orders SET user_id = $1 WHERE id = $2`,
      [user.id, orderId]
    );

    await client.query('COMMIT');
    return user;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function getUserByEmail(email) {
  const res = await db.query(
    `SELECT * FROM users WHERE email = $1`,
    [email.toLowerCase().trim()]
  );
  return res.rows[0] || null;
}

async function updateLastLogin(userId) {
  await db.query(
    `UPDATE users SET last_login_at = NOW() WHERE id = $1`,
    [userId]
  );
}

module.exports = {
  hashPassword,
  verifyPassword,
  signToken,
  verifyToken,
  requireAuth,
  createUser,
  getUserByEmail,
  updateLastLogin,
};
