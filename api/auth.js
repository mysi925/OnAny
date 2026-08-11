'use strict';

const express = require('express');
const {
  createUser, getUserByEmail,
  verifyPassword, signToken, requireAuth, updateLastLogin,
} = require('../lib/auth');
const { getOrderByToken, isTokenValid } = require('../lib/tokens');

const router = express.Router();

const COOKIE_OPTS = {
  httpOnly: true,
  secure:   process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge:   30 * 24 * 60 * 60 * 1000, // 30 days
  path:     '/',
};

// ── POST /api/auth/register ───────────────────────────────────────────────────
// Called from the success page. Requires a valid download token.
router.post('/auth/register', async (req, res) => {
  try {
    const { email, password, token } = req.body;

    if (!email || !password || !token) {
      return res.status(400).json({ error: 'Email, password, and token required.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }

    // Validate the download token is still in the 48hr window
    const order = await getOrderByToken(token);
    if (!order || !isTokenValid(order)) {
      return res.status(403).json({ error: 'This link has expired. Your access window has closed.' });
    }
    if (order.user_id) {
      return res.status(409).json({ error: 'An account is already linked to this order.' });
    }

    // Create user
    let user;
    try {
      user = await createUser(email, password, order.id, order.tier);
    } catch (err) {
      if (err.code === '23505') {
        return res.status(409).json({ error: 'An account with that email already exists.' });
      }
      throw err;
    }

    const jwt = signToken(user.id, user.tier);
    res.cookie('woa_token', jwt, COOKIE_OPTS);
    return res.json({ ok: true, tier: user.tier });

  } catch (err) {
    console.error('[auth/register] error:', err.message);
    return res.status(500).json({ error: 'Registration failed.' });
  }
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required.' });
    }

    const user = await getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    await updateLastLogin(user.id);
    const jwt = signToken(user.id, user.tier);
    res.cookie('woa_token', jwt, COOKIE_OPTS);
    return res.json({ ok: true, tier: user.tier });

  } catch (err) {
    console.error('[auth/login] error:', err.message);
    return res.status(500).json({ error: 'Login failed.' });
  }
});

// ── POST /api/auth/logout ─────────────────────────────────────────────────────
router.post('/auth/logout', (req, res) => {
  res.clearCookie('woa_token', { path: '/' });
  return res.json({ ok: true });
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get('/api/auth/me', requireAuth, (req, res) => {
  return res.json({ userId: req.user.sub, tier: req.user.tier });
});

module.exports = router;
