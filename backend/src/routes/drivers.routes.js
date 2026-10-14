const express = require('express');
const { requireRole } = require('../middleware/role.middleware');
const { ROLES } = require('../config/roles');
const { listDrivers, getDriverDetails } = require('../controllers/drivers.controller');

const router = express.Router();

// Driver records are operationally visible to managers/officers only.
router.use(requireRole(ROLES.MANAGER));
router.get('/', listDrivers);
router.get('/:driverId', getDriverDetails);

module.exports = router;
