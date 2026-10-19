const express = require('express');
const { requireRole } = require('../middleware/role.middleware');
const { ROLES } = require('../config/roles');
const { listFuelLogs } = require('../controllers/fuelLogs.controller');

const router = express.Router();
router.use(requireRole(ROLES.MANAGER));
router.get('/', listFuelLogs);

module.exports = router;
