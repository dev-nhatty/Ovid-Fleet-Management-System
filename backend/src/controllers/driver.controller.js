const pool = require('../db/pool');

const validId = (value) => Number.isSafeInteger(Number(value)) && Number(value) > 0;

async function listMyTrips(req, res, next) {
  try {
    const { rows } = await pool.query(
      `SELECT t.id AS trip_id, t.status, t.assigned_at, t.started_at, t.completed_at,
              t.driver_start_requested_at, t.driver_finish_requested_at,
              tr.id AS request_id, tr.origin,
              COALESCE(tr.destination, (
                SELECT tc.location FROM trip_checkpoints tc
                 WHERE tc.trip_request_id = tr.id
                 ORDER BY tc.sequence_order DESC LIMIT 1
              )) AS destination,
              tr.trip_type, tr.additional_passenger_count,
              e.name AS passenger_name, e.phone AS passenger_phone,
              dep.name AS department,
              v.plate_number, v.brand_name, v.model_name, v.model_year,
              assigner.name AS assigned_by,
              (SELECT COUNT(*)::int FROM trip_checkpoints tc
                WHERE tc.trip_request_id = tr.id) AS checkpoint_count
         FROM trips t
         JOIN trip_requests tr ON tr.id = t.trip_request_id
         JOIN employees e ON e.id = tr.employee_id
         LEFT JOIN departments dep ON dep.id = e.department_id
         JOIN vehicles v ON v.id = t.vehicle_id
         LEFT JOIN users assigner ON assigner.id = t.recorded_by_user_id
        WHERE t.driver_id = $1
        ORDER BY t.assigned_at DESC, t.id DESC`,
      [req.user.id]
    );
    res.json({ trips: rows });
  } catch (err) { next(err); }
}

async function listDriverDirectory(req, res, next) {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, phone FROM users
        WHERE role = 'Driver' AND status = 'Active'
        ORDER BY LOWER(name), id`
    );
    res.json({ drivers: rows });
  } catch (err) { next(err); }
}

async function requestLifecycleAction(req, res, next) {
  const tripId = Number(req.params.tripId);
  const action = req.params.action;
  if (!validId(tripId) || !['start', 'finish'].includes(action)) {
    return res.status(400).json({ error: 'Invalid trip action.' });
  }

  const isStart = action === 'start';
  const expectedStatus = isStart ? 'Assigned' : 'In Progress';
  const column = isStart ? 'driver_start_requested_at' : 'driver_finish_requested_at';
  try {
    const result = await pool.query(
      `UPDATE trips
          SET ${column} = COALESCE(${column}, NOW())
        WHERE id = $1 AND driver_id = $2 AND status = $3
        RETURNING id, status, ${column}`,
      [tripId, req.user.id, expectedStatus]
    );
    if (!result.rowCount) {
      const existing = await pool.query(
        'SELECT status FROM trips WHERE id = $1 AND driver_id = $2',
        [tripId, req.user.id]
      );
      if (!existing.rowCount) return res.status(404).json({ error: 'This trip is not assigned to your driver account.' });
      return res.status(409).json({
        error: isStart
          ? 'A start request is only available while the trip is assigned.'
          : 'A finish request is only available while the trip is in progress.',
        status: existing.rows[0].status,
      });
    }
    return res.json({
      trip: result.rows[0],
      message: isStart
        ? 'Start request sent to dispatch. The officer must officially start the trip.'
        : 'Finish request sent to dispatch. The officer must confirm official completion.',
    });
  } catch (err) { next(err); }
}

module.exports = { listMyTrips, listDriverDirectory, requestLifecycleAction };
