const express = require('express');
const rateLimit = require('express-rate-limit');
const { login, logout, me } = require('../controllers/auth.controller');
const { requireAuth } = require('../middleware/auth.middleware');

const router = express.Router();

// Slows password guessing: 10 FAILED attempts per IP per 15 minutes.
// Successful logins are not counted, because everyone in an office
// usually shares one public IP and a busy morning must not lock the
// whole team out. Behind a reverse proxy in production, app.js sets
// 'trust proxy' so this sees real client IPs rather than the proxy's.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again later.' },
});

router.post('/login', loginLimiter, login);
router.post('/logout', logout);
router.get('/me', requireAuth, me);

module.exports = router;
