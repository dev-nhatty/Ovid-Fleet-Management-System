const pool = require('../db/pool');

const parseDriverId = (value) => {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

/**
 * Driver registry. Driver availability is derived from active trip records,
 * not stored in users.status. Only active Driver accounts are listed.
 */
async function listDrivers(req, res, next) {
  try {
    const { rows } = await pool.query(
      `SELECT
          u.id,
          u.name,
          u.phone,
          active_trip.trip_id AS current_trip_id,
          active_trip.destination AS current_trip_destination,
          active_trip.trip_status AS current_trip_status,
          active_trip.assigned_at AS current_trip_assigned_at,
          CASE WHEN active_trip.trip_id IS NOT NULL THEN 'On Trip' ELSE 'Available' END AS operational_status
        FROM users u
        LEFT JOIN LATERAL (
          SELECT t.id AS trip_id, tr.destination, t.status AS trip_status, t.assigned_at
            FROM trips t
            JOIN trip_requests tr ON tr.id = t.trip_request_id
           WHERE t.driver_id = u.id
             AND t.status IN ('Assigned', 'In Progress')
           ORDER BY t.assigned_at DESC, t.id DESC
           LIMIT 1
        ) active_trip ON TRUE
       WHERE u.role = 'Driver'
         AND u.status = 'Active'
       ORDER BY u.name ASC, u.id ASC`
    );

    const summary = rows.reduce((counts, driver) => {
      counts.total += 1;
      if (driver.operational_status === 'On Trip') counts.onTrip += 1;
      else counts.available += 1;
      return counts;
    }, { total: 0, available: 0, onTrip: 0 });

    res.json({ drivers: rows, summary, refreshedAt: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
}

/**
 * Driver details and recent trip history. No schema changes are needed.
 */
async function getDriverDetails(req, res, next) {
  const driverId = parseDriverId(req.params.driverId);
  if (!driverId) return res.status(400).json({ error: 'Invalid driver ID.' });

  try {
    const driverResult = await pool.query(
      `SELECT
          u.id,
          u.name,
          u.phone,
          u.status AS account_status,
          active_trip.trip_id AS current_trip_id,
          active_trip.destination AS current_trip_destination,
          active_trip.trip_status AS current_trip_status,
          active_trip.assigned_at AS current_trip_assigned_at,
          CASE
            WHEN u.status <> 'Active' THEN 'Unavailable'
            WHEN active_trip.trip_id IS NOT NULL THEN 'On Trip'
            ELSE 'Available'
          END AS operational_status
        FROM users u
        LEFT JOIN LATERAL (
          SELECT t.id AS trip_id, tr.destination, t.status AS trip_status, t.assigned_at
            FROM trips t
            JOIN trip_requests tr ON tr.id = t.trip_request_id
           WHERE t.driver_id = u.id
             AND t.status IN ('Assigned', 'In Progress')
           ORDER BY t.assigned_at DESC, t.id DESC
           LIMIT 1
        ) active_trip ON TRUE
       WHERE u.id = $1
         AND u.role = 'Driver'`,
      [driverId]
    );

    if (!driverResult.rowCount) {
      return res.status(404).json({ error: 'Driver not found.' });
    }

    const recentTripsResult = await pool.query(
      `SELECT
          t.id AS trip_id,
          tr.destination,
          t.status AS trip_status,
          t.assigned_at,
          t.started_at,
          t.completed_at,
          COALESCE(t.completed_at, t.started_at, t.assigned_at) AS activity_at
        FROM trips t
        JOIN trip_requests tr ON tr.id = t.trip_request_id
       WHERE t.driver_id = $1
       ORDER BY COALESCE(t.completed_at, t.started_at, t.assigned_at) DESC, t.id DESC
       LIMIT 5`,
      [driverId]
    );

    res.json({
      driver: driverResult.rows[0],
      recentTrips: recentTripsResult.rows,
      refreshedAt: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { listDrivers, getDriverDetails };
