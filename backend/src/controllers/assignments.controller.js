const pool = require('../db/pool');

const parseId = (value) => {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

async function getAssignmentDetails(req, res, next) {
  const requestId = parseId(req.params.requestId);
  if (!requestId) return res.status(400).json({ error: 'Invalid trip request ID.' });

  try {
    const requestResult = await pool.query(
      `SELECT tr.id, tr.employee_id, e.name AS employee_name, d.name AS department,
              tr.destination, tr.trip_type, tr.status, tr.requested_at,
              COALESCE(json_agg(json_build_object('id', tc.id, 'location', tc.location,
                'sequenceOrder', tc.sequence_order) ORDER BY tc.sequence_order)
                FILTER (WHERE tc.id IS NOT NULL), '[]') AS checkpoints,
              t.id AS trip_id
         FROM trip_requests tr
         JOIN employees e ON e.id = tr.employee_id
         LEFT JOIN departments d ON d.id = e.department_id
         LEFT JOIN trip_checkpoints tc ON tc.trip_request_id = tr.id
         LEFT JOIN trips t ON t.trip_request_id = tr.id
        WHERE tr.id = $1
        GROUP BY tr.id, e.name, d.name, t.id`,
      [requestId]
    );
    if (!requestResult.rowCount) return res.status(404).json({ error: 'Trip request not found.' });

    const [vehiclesResult, driversResult, pendingResult] = await Promise.all([
      pool.query(
        `SELECT v.id, v.plate_number, v.status, vt.name AS vehicle_type,
                ft.name AS fuel_type
           FROM vehicles v
           LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
           LEFT JOIN fuel_types ft ON ft.id = v.fuel_type_id
          WHERE v.status = 'Active'
            AND NOT EXISTS (
              SELECT 1 FROM trips t
               WHERE t.vehicle_id = v.id AND t.status IN ('Assigned', 'In Progress')
            )
          ORDER BY v.plate_number`
      ),
      pool.query(
        `SELECT u.id, u.name, u.phone
           FROM users u
          WHERE u.role = 'Driver' AND u.status = 'Active'
            AND NOT EXISTS (
              SELECT 1 FROM trips t
               WHERE t.driver_id = u.id AND t.status IN ('Assigned', 'In Progress')
            )
          ORDER BY LOWER(u.name), u.id`
      ),
      pool.query(
        `SELECT id, destination, trip_type, requested_at
           FROM trip_requests
          WHERE status = 'Pending'
          ORDER BY requested_at ASC, id ASC
          LIMIT 100`
      ),
    ]);

    res.json({
      request: requestResult.rows[0],
      vehicles: vehiclesResult.rows,
      drivers: driversResult.rows,
      pendingRequests: pendingResult.rows,
    });
  } catch (err) { next(err); }
}

async function assignTrip(req, res, next) {
  const requestId = parseId(req.params.requestId);
  const vehicleId = parseId(req.body?.vehicleId);
  const driverId = parseId(req.body?.driverId);
  const fields = {};
  if (!requestId) return res.status(400).json({ error: 'Invalid trip request ID.' });
  if (!vehicleId) fields.vehicleId = 'Choose a vehicle.';
  if (!driverId) fields.driverId = 'Choose a driver.';
  if (Object.keys(fields).length) return res.status(400).json({ error: 'Choose both a vehicle and a driver.', fields });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const requestResult = await client.query(
      `SELECT id, status FROM trip_requests WHERE id = $1 FOR UPDATE`, [requestId]
    );
    if (!requestResult.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Trip request not found.' });
    }
    const request = requestResult.rows[0];
    if (request.status !== 'Pending') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: `This request is ${request.status.toLowerCase()} and cannot be assigned again.` });
    }

    // Lock the chosen resources while checking availability to reduce assignment races.
    const vehicleResult = await client.query(
      `SELECT id FROM vehicles WHERE id = $1 AND status = 'Active' FOR UPDATE`, [vehicleId]
    );
    if (!vehicleResult.rowCount) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'That vehicle is not active. Refresh availability and choose another.' });
    }
    const driverResult = await client.query(
      `SELECT id FROM users WHERE id = $1 AND role = 'Driver' AND status = 'Active' FOR UPDATE`, [driverId]
    );
    if (!driverResult.rowCount) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'That driver is not active or is not registered as a driver. Refresh availability and choose another.' });
    }

    const [vehicleBusy, driverBusy] = await Promise.all([
      client.query(`SELECT 1 FROM trips WHERE vehicle_id = $1 AND status IN ('Assigned', 'In Progress') LIMIT 1`, [vehicleId]),
      client.query(`SELECT 1 FROM trips WHERE driver_id = $1 AND status IN ('Assigned', 'In Progress') LIMIT 1`, [driverId]),
    ]);
    if (vehicleBusy.rowCount || driverBusy.rowCount) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'The selected vehicle or driver has just been assigned to another trip. Refresh availability.' });
    }

    const inserted = await client.query(
      `INSERT INTO trips (trip_request_id, vehicle_id, driver_id, status, recorded_by_user_id)
       VALUES ($1, $2, $3, 'Assigned', $4)
       RETURNING id, trip_request_id, vehicle_id, driver_id, status, assigned_at`,
      [requestId, vehicleId, driverId, req.user.id]
    );
    await client.query(`UPDATE trip_requests SET status = 'Assigned' WHERE id = $1`, [requestId]);
    await client.query('COMMIT');
    res.status(201).json({ trip: inserted.rows[0], message: 'Vehicle and driver assigned successfully.' });
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch {}
    if (err.code === '23505') return res.status(409).json({ error: 'This request or resource has already been assigned. Refresh and try again.' });
    next(err);
  } finally { client.release(); }
}

module.exports = { getAssignmentDetails, assignTrip };
