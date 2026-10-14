// TEMPORARY. Delete this file (and its line in app.js) once you have
// real routes. It exists so you can prove authorization works before
// any real endpoint exists: signed in as a Manager, /manager-only
// answers 200 and /admin-only answers 403, and the reverse for an admin.
const express = require('express');
const { requireRole } = require('../middleware/role.middleware');
const { ROLES } = require('../config/roles');

const router = express.Router();

router.get('/any-signed-in-user', (req, res) => {
  res.json({ ok: true, area: 'any', username: req.user.username, role: req.user.role });
});

router.get('/manager-only', requireRole(ROLES.MANAGER), (req, res) => {
  res.json({ ok: true, area: 'manager', username: req.user.username });
});

router.get('/admin-only', requireRole(ROLES.ADMIN), (req, res) => {
  res.json({ ok: true, area: 'admin', username: req.user.username });
});

module.exports = router;
