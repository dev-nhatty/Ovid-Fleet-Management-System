const express = require('express');
const { requireRole } = require('../middleware/role.middleware');
const { ROLES } = require('../config/roles');
const { listMyTrips, listDriverDirectory, requestLifecycleAction } = require('../controllers/driver.controller');

const router = express.Router();
router.use(requireRole(ROLES.DRIVER));
router.get('/trips', listMyTrips);
router.get('/directory', listDriverDirectory);
router.post('/trips/:tripId/:action-request', requestLifecycleAction);
module.exports = router;
