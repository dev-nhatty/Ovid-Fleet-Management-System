const express = require('express');
const { requireRole } = require('../middleware/role.middleware');
const { ROLES } = require('../config/roles');
const { getDashboard } = require('../controllers/dashboard.controller');
const router = express.Router();
router.use(requireRole(ROLES.MANAGER));
router.get('/', getDashboard);
module.exports = router;
