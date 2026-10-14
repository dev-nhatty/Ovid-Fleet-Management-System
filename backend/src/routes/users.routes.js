const express = require('express');
const { createUser, listUsers, updateUserStatus, resetUserPassword } = require('../controllers/users.controller');

// Mounted in app.js behind requireAuth AND requireRole(ROLES.ADMIN), so
// every route in this file is administrator-only.
const router = express.Router();

router.get('/', listUsers);
router.post('/', createUser);
router.patch('/:id/status', updateUserStatus);
router.put('/:id/password', resetUserPassword);

module.exports = router;
