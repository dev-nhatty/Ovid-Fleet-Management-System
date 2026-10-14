const express = require('express');
const { requireRole } = require('../middleware/role.middleware');
const { ROLES } = require('../config/roles');
const { listVehicles, getVehicleDetails } = require('../controllers/vehicles.controller');

const router = express.Router();
router.use(requireRole(ROLES.MANAGER));
router.get('/', listVehicles);
router.get('/:vehicleId', getVehicleDetails);

module.exports = router;
