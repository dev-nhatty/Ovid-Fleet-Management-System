const pool = require('../db/pool');

const PAGE_SIZE_DEFAULT = 10;
const PAGE_SIZE_MAX = 100;
const cleanText = (value) => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
const parsePositiveInt = (value, fallback = null) => {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : fallback;
};

function validateDepartment(body = {}, { partial = false } = {}) {
  const fields = {};
  const value = {};
  if (!partial || Object.hasOwn(body, 'name')) {
    value.name = cleanText(body.name);
    if (!value.name) fields.name = 'Department name is required.';
    else if (value.name.length > 100) fields.name = 'Department name must be 100 characters or fewer.';
  }
  if (!partial || Object.hasOwn(body, 'code')) {
    value.code = cleanText(body.code).toUpperCase();
    if (!value.code) fields.code = 'Department code is required.';
    else if (!/^[A-Z0-9][A-Z0-9_-]{1,19}$/.test(value.code)) fields.code = 'Use 2–20 letters, numbers, dashes, or underscores.';
  }
  if (!partial || Object.hasOwn(body, 'description')) {
    const description = typeof body.description === 'string' ? body.description.trim() : '';
    if (description.length > 500) fields.description = 'Description must be 500 characters or fewer.';
    value.description = description || null;
  }
  if (!partial || Object.hasOwn(body, 'departmentHeadEmployeeId')) {
    const raw = body.departmentHeadEmployeeId;
    if (raw === '' || raw === null || raw === undefined) value.departmentHeadEmployeeId = null;
    else {
      const id = parsePositiveInt(raw);
      if (!id) fields.departmentHeadEmployeeId = 'Choose a valid employee.';
      else value.departmentHeadEmployeeId = id;
    }
  }
  if (!partial || Object.hasOwn(body, 'status')) {
    const status = body.status ?? 'Active';
    if (!['Active', 'Inactive'].includes(status)) fields.status = 'Choose Active or Inactive.';
    else value.status = status;
  }
  return { fields, value };
}

function isUniqueViolation(err) { return err && err.code === '23505'; }
function isForeignKeyViolation(err) { return err && err.code === '23503'; }

async function listDepartments(req, res, next) {
  try {
    const q = cleanText(req.query.q).slice(0, 120);
    const status = ['Active', 'Inactive'].includes(req.query.status) ? req.query.status : '';
    const page = parsePositiveInt(req.query.page, 1);
    const pageSize = Math.min(parsePositiveInt(req.query.pageSize, PAGE_SIZE_DEFAULT), PAGE_SIZE_MAX);
    const values = [];
    const where = [];
    if (status) { values.push(status); where.push(`d.status = $${values.length}`); }
    if (q) {
      values.push(`%${q}%`);
      const p = `$${values.length}`;
      where.push(`(d.name ILIKE ${p} OR d.code ILIKE ${p} OR COALESCE(d.description, '') ILIKE ${p} OR COALESCE(head.name, '') ILIKE ${p})`);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const count = await pool.query(
      `SELECT COUNT(*)::int AS total FROM departments d LEFT JOIN employees head ON head.id = d.department_head_employee_id ${whereSql}`,
      values
    );
    const total = count.rows[0].total;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, totalPages);
    const offset = (safePage - 1) * pageSize;
    const listValues = [...values, pageSize, offset];
    const { rows } = await pool.query(
      `SELECT d.id, d.name, d.code, d.description, d.status,
              d.department_head_employee_id AS department_head_employee_id,
              head.name AS department_head_name,
              COUNT(e.id)::int AS employee_count
         FROM departments d
         LEFT JOIN employees head ON head.id = d.department_head_employee_id
         LEFT JOIN employees e ON e.department_id = d.id
         ${whereSql}
        GROUP BY d.id, head.id, head.name
        ORDER BY d.name ASC, d.id ASC
        LIMIT $${listValues.length - 1} OFFSET $${listValues.length}`,
      listValues
    );
    const summaryResult = await pool.query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE status = 'Active')::int AS active,
              COUNT(*) FILTER (WHERE status = 'Inactive')::int AS inactive
         FROM departments`
    );
    const unassigned = await pool.query(`SELECT COUNT(*)::int AS count FROM employees WHERE department_id IS NULL AND status = 'Active'`);
    res.json({ departments: rows, total, page: safePage, pageSize, totalPages, summary: { ...summaryResult.rows[0], unassignedEmployees: unassigned.rows[0].count } });
  } catch (err) { next(err); }
}

async function listDepartmentHeads(req, res, next) {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, phone, department_id FROM employees WHERE status = 'Active' ORDER BY name ASC, id ASC`
    );
    res.json({ employees: rows });
  } catch (err) { next(err); }
}

async function getDepartment(req, res, next) {
  const id = parsePositiveInt(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid department ID.' });
  try {
    const result = await pool.query(
      `SELECT d.id, d.name, d.code, d.description, d.status,
              d.department_head_employee_id,
              head.name AS department_head_name,
              COUNT(e.id)::int AS employee_count
         FROM departments d
         LEFT JOIN employees head ON head.id = d.department_head_employee_id
         LEFT JOIN employees e ON e.department_id = d.id
        WHERE d.id = $1
        GROUP BY d.id, head.id, head.name`, [id]
    );
    if (!result.rowCount) return res.status(404).json({ error: 'Department not found.' });
    const employees = await pool.query(
      `SELECT id, name, phone, status FROM employees WHERE department_id = $1 ORDER BY name ASC, id ASC`, [id]
    );
    res.json({ department: result.rows[0], employees: employees.rows });
  } catch (err) { next(err); }
}

async function createDepartment(req, res, next) {
  const { fields, value } = validateDepartment(req.body);
  if (Object.keys(fields).length) return res.status(400).json({ error: 'Please correct the highlighted fields.', fields });
  try {
    if (value.departmentHeadEmployeeId) {
      const head = await pool.query(`SELECT 1 FROM employees WHERE id = $1 AND status = 'Active'`, [value.departmentHeadEmployeeId]);
      if (!head.rowCount) return res.status(400).json({ error: 'Choose an active employee as department head.', fields: { departmentHeadEmployeeId: 'Choose an active employee.' } });
    }
    const { rows } = await pool.query(
      `INSERT INTO departments (name, code, description, department_head_employee_id, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, code, description, status, department_head_employee_id`,
      [value.name, value.code, value.description, value.departmentHeadEmployeeId, value.status]
    );
    res.status(201).json({ department: { ...rows[0], department_head_name: null, employee_count: 0 } });
  } catch (err) {
    if (isUniqueViolation(err)) return res.status(409).json({ error: 'A department with that name or code already exists.', fields: { code: 'Department name and code must be unique.' } });
    if (isForeignKeyViolation(err)) return res.status(400).json({ error: 'The selected department head no longer exists.' });
    next(err);
  }
}

async function updateDepartment(req, res, next) {
  const id = parsePositiveInt(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid department ID.' });
  const { fields, value } = validateDepartment(req.body, { partial: true });
  if (Object.keys(fields).length) return res.status(400).json({ error: 'Please correct the highlighted fields.', fields });
  const allowed = ['name', 'code', 'description', 'departmentHeadEmployeeId', 'status'];
  if (!allowed.some((key) => Object.hasOwn(value, key))) return res.status(400).json({ error: 'No department changes were supplied.' });
  try {
    if (value.departmentHeadEmployeeId) {
      const head = await pool.query(`SELECT 1 FROM employees WHERE id = $1 AND status = 'Active'`, [value.departmentHeadEmployeeId]);
      if (!head.rowCount) return res.status(400).json({ error: 'Choose an active employee as department head.', fields: { departmentHeadEmployeeId: 'Choose an active employee.' } });
    }
    const columns = { name: 'name', code: 'code', description: 'description', departmentHeadEmployeeId: 'department_head_employee_id', status: 'status' };
    const sets = []; const params = [];
    for (const key of allowed) if (Object.hasOwn(value, key)) { params.push(value[key]); sets.push(`${columns[key]} = $${params.length}`); }
    params.push(id);
    const { rows } = await pool.query(
      `UPDATE departments SET ${sets.join(', ')} WHERE id = $${params.length}
       RETURNING id, name, code, description, status, department_head_employee_id`, params
    );
    if (!rows.length) return res.status(404).json({ error: 'Department not found.' });
    res.json({ department: rows[0] });
  } catch (err) {
    if (isUniqueViolation(err)) return res.status(409).json({ error: 'A department with that name or code already exists.', fields: { code: 'Department name and code must be unique.' } });
    if (isForeignKeyViolation(err)) return res.status(400).json({ error: 'The selected department head no longer exists.' });
    next(err);
  }
}

async function updateDepartmentStatus(req, res, next) {
  const id = parsePositiveInt(req.params.id);
  const status = req.body?.status;
  if (!id) return res.status(400).json({ error: 'Invalid department ID.' });
  if (!['Active', 'Inactive'].includes(status)) return res.status(400).json({ error: 'Choose Active or Inactive.' });
  try {
    const { rows } = await pool.query(`UPDATE departments SET status = $1 WHERE id = $2 RETURNING id, name, code, status`, [status, id]);
    if (!rows.length) return res.status(404).json({ error: 'Department not found.' });
    res.json({ department: rows[0] });
  } catch (err) { next(err); }
}

module.exports = { listDepartments, listDepartmentHeads, getDepartment, createDepartment, updateDepartment, updateDepartmentStatus };
