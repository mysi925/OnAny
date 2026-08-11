'use strict';

// ── FIXED: routes are registered WITHOUT the /api prefix ─────────────────────
// server.js mounts this router at app.use('/api', authRoute), so:
//   router.get('/auth/me', ...)    → resolves to GET /api/auth/me  ✓
//   router.get('/api/auth/me', ...)→ resolves to GET /api/api/auth/me  ✗ (was the bug)

const express = require('express');
const jwt     = require('jsonwebtoken');
const bcrypt  = require('bcryptjs');
const pool    = require('../lib/db');

const router = express.Router();

function issueToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, tier: user.tier },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Unauthorized.' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Token invalid or expired.' });
  }
}

// POST /api/auth/register
router.post('/auth/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required.' });

    const hash   = await bcrypt.hash(password, 12);
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, tier)
       VALUES ($1, $2, 'none')
       ON CONFLICT (email) DO NOTHING
       RETURNING id, email, tier`,
      [email.toLowerCase().trim(), hash]
    );

    if (result.rowCount === 0) return res.status(409).json({ error: 'Email already registered.' });

    const user = result.rows[0];
    return res.status(201).json({ token: issueToken(user), tier: user.tier });
  } catch (err) {
    console.error('[auth/register]', err.message);
    return res.status(500).json({ error: 'Registration failed.' });
  }
});

// POST /api/auth/login
router.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required.' });

    const result = await pool.query(
      'SELECT id, email, password_hash, tier FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );

    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid credentials.' });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok)  return res.status(401).json({ error: 'Invalid credentials.' });

    return res.json({ token: issueToken(user), tier: user.tier });
  } catch (err) {
    console.error('[auth/login]', err.message);
    return res.status(500).json({ error: 'Login failed.' });
  }
});

// GET /api/auth/me  ← was /api/api/auth/me before fix
router.get('/auth/me', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, tier, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: 'User not found.' });
    return res.json({ user });
  } catch (err) {
    console.error('[auth/me]', err.message);
    return res.status(500).json({ error: 'Failed to load profile.' });
  }
});

// POST /api/auth/logout  (client-side token removal; server just confirms)
router.post('/auth/logout', (req, res) => {
  return res.json({ success: true });
});

module.exports = router;
module.exports.requireAuth = requireAuth;
