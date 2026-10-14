const express = require('express');
const { requireRole } = require('../middleware/role.middleware');
const { ROLES } = require('../config/roles');
const { searchEmployees, createTripRequest, listTripRequests } = require('../controllers/tripRequests.controller');
const { getAssignmentDetails, assignTrip } = require('../controllers/assignments.controller');

const router = express.Router();
router.use(requireRole(ROLES.MANAGER));
router.get('/employees', searchEmployees);
router.get('/:requestId/assignment-options', getAssignmentDetails);
router.post('/:requestId/assign', assignTrip);
router.get('/', listTripRequests);
router.post('/', createTripRequest);
module.exports = router;
