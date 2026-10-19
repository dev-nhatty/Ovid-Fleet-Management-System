const pool = require('../db/pool');

const TRIP_TYPES = ['One-way', 'Round Trip', 'With Checkpoints'];
const MAX_INT4 = 2147483647;
const str = (v) => typeof v === 'string' ? v.trim() : '';
const validId = (v) => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isInteger(n) && n > 0 && n <= MAX_INT4 ? n : null;
};

async function searchEmployees(req, res, next) {
  const q = str(req.query.q).slice(0, 100);
  if (q.length < 1) return res.json({ employees: [] });
  try {
    const { rows } = await pool.query(
      `SELECT e.id, e.name, e.phone, e.department_id,
              d.name AS department
         FROM employees e
         LEFT JOIN departments d ON d.id = e.department_id
        WHERE e.status = 'Active'
          AND (e.name ILIKE $1 OR CAST(e.id AS TEXT) = $2 OR COALESCE(e.phone, '') ILIKE $1)
        ORDER BY LOWER(e.name), e.id
        LIMIT 12`,
      [`%${q.replace(/[\\%_]/g, '\\$&')}%`, q]
    );
    res.json({ employees: rows });
  } catch (err) { next(err); }
}

async function listTripRequests(req, res, next) {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const pageSize = Math.min(50, Math.max(1, Number.parseInt(req.query.pageSize, 10) || 10));
  try {
    const count = await pool.query('SELECT COUNT(*)::int AS total FROM trip_requests');
    const total = count.rows[0].total;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const currentPage = Math.min(page, totalPages);
    const { rows } = await pool.query(
      `SELECT tr.id, tr.employee_id, e.name AS employee_name, d.name AS department,
              tr.origin, COALESCE(tr.destination, (SELECT tc2.location FROM trip_checkpoints tc2 WHERE tc2.trip_request_id = tr.id ORDER BY tc2.sequence_order DESC LIMIT 1)) AS destination, tr.trip_type, tr.status, tr.requested_at,
              tr.recorded_by_user_id,
              COALESCE(json_agg(json_build_object('id', tc.id, 'location', tc.location,
                'sequenceOrder', tc.sequence_order)
                ORDER BY tc.sequence_order) FILTER (WHERE tc.id IS NOT NULL), '[]') AS checkpoints
         FROM trip_requests tr
         JOIN employees e ON e.id = tr.employee_id
         LEFT JOIN departments d ON d.id = e.department_id
         LEFT JOIN trip_checkpoints tc ON tc.trip_request_id = tr.id
        GROUP BY tr.id, e.name, d.name
        ORDER BY tr.requested_at DESC, tr.id DESC
        LIMIT $1 OFFSET $2`,
      [pageSize, (currentPage - 1) * pageSize]
    );
    res.json({ requests: rows, total, page: currentPage, pageSize, totalPages });
  } catch (err) { next(err); }
}

async function createTripRequest(req, res, next) {
  const body = req.body || {};
  const employeeId = validId(body.employeeId);
  const origin = str(body.origin);
  const destination = str(body.destination);
  const tripType = body.tripType;
  const checkpoints = Array.isArray(body.checkpoints) ? body.checkpoints : [];
  const fields = {};

  if (!employeeId) fields.employeeId = 'Choose an employee from the directory.';
  if (!origin) fields.origin = 'Origin is required.';
  else if (origin.length > 255) fields.origin = 'Origin must be 255 characters or fewer.';
  if (tripType !== 'With Checkpoints' && !destination) fields.destination = 'Destination is required.';
  else if (destination.length > 255) fields.destination = 'Destination must be 255 characters or fewer.';
  if (!TRIP_TYPES.includes(tripType)) fields.tripType = 'Choose a valid trip mode.';
  if (!Array.isArray(body.checkpoints)) fields.checkpoints = 'Checkpoints must be a list.';
  if (checkpoints.length > 20) fields.checkpoints = 'You can add up to 20 checkpoints.';
  const normalizedStops = checkpoints.map((s, i) => {
    const location = str(s && s.location);
    if (!location || location.length > 255) fields[`checkpoint_${i}`] = 'Enter a checkpoint location (255 characters max).';
    return { location };
  });
  if (tripType === 'With Checkpoints' && normalizedStops.length === 0) {
    fields.checkpoints = 'Add at least one checkpoint for this trip mode.';
  }
  if (tripType !== 'With Checkpoints' && normalizedStops.length > 0) {
    fields.checkpoints = 'Checkpoints are only allowed when “With Checkpoints” is selected.';
  }
  if (Object.keys(fields).length) {
    return res.status(400).json({ error: 'Please correct the highlighted fields.', fields });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const employee = await client.query(
      `SELECT id FROM employees WHERE id = $1 AND status = 'Active' FOR SHARE`,
      [employeeId]
    );
    if (!employee.rowCount) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'That employee is no longer active. Choose another employee.',
        fields: { employeeId: 'Employee is not active.' },
      });
    }

    const inserted = await client.query(
      `INSERT INTO trip_requests
        (employee_id, origin, destination, trip_type, status, recorded_by_user_id)
       VALUES ($1, $2, $3, $4, 'Pending', $5)
       RETURNING id, employee_id, origin, destination, trip_type, status, requested_at, recorded_by_user_id`,
      [employeeId, origin, tripType === 'With Checkpoints' ? null : destination, tripType, req.user.id]
    );
    const request = inserted.rows[0];
    for (let i = 0; i < normalizedStops.length; i++) {
      await client.query(
        `INSERT INTO trip_checkpoints (trip_request_id, sequence_order, location)
         VALUES ($1, $2, $3)`,
        [request.id, i + 1, normalizedStops[i].location]
      );
    }
    await client.query('COMMIT');
    res.status(201).json({
      ...request,
      destination: tripType === 'With Checkpoints' ? (normalizedStops[normalizedStops.length - 1]?.location || null) : request.destination,
      checkpoints: normalizedStops.map((s, i) => ({ sequenceOrder: i + 1, ...s })),
    });
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch {}
    next(err);
  } finally {
    client.release();
  }
}

module.exports = { searchEmployees, createTripRequest, listTripRequests };
