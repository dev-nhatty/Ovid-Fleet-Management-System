const express = require('express');
const { login, logout, me } = require('../controllers/auth.controller');
const { requireAuth } = require('../middleware/auth.middleware');

const router = express.Router();

// Authentication endpoints are mounted at /api/auth in app.js.
// Login and logout are public; /me requires a valid session.
router.post('/login', login);
router.post('/logout', logout);
router.get('/me', requireAuth, me);

module.exports = router;
