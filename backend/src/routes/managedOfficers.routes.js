const express = require('express');
const { listManagedOfficers, createManagedOfficer, updateManagedOfficerStatus } = require('../controllers/users.controller');
const router = express.Router();
router.get('/', listManagedOfficers);
router.post('/', createManagedOfficer);
router.patch('/:id/status', updateManagedOfficerStatus);
module.exports = router;
