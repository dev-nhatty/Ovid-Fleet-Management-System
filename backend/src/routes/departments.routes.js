const express = require('express');
const { requireRole } = require('../middleware/role.middleware');
const { ROLES } = require('../config/roles');
const {
  listDepartments, getDepartment,
  createDepartment, updateDepartment, updateDepartmentStatus,
} = require('../controllers/departments.controller');

const router = express.Router();
router.use(requireRole(ROLES.ADMIN));
router.get('/', listDepartments);
router.post('/', createDepartment);
router.get('/:id', getDepartment);
router.patch('/:id', updateDepartment);
router.patch('/:id/status', updateDepartmentStatus);
module.exports = router;
