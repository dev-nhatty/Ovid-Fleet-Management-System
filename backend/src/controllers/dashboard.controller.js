const pool = require('../db/pool');

async function getDashboard(req, res, next) {
  try {
    const [requests, trips, vehicles, drivers, fuel, recent] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS pending FROM trip_requests WHERE status = 'Pending'`),
      pool.query(`SELECT COUNT(*)::int AS active FROM trips WHERE status IN ('Assigned', 'In Progress')`),
      pool.query(`SELECT COUNT(*)::int AS available FROM vehicles v WHERE v.status = 'Active' AND NOT EXISTS (SELECT 1 FROM trips t WHERE t.vehicle_id = v.id AND t.status IN ('Assigned', 'In Progress'))`),
      pool.query(`SELECT COUNT(*)::int AS available FROM users u WHERE u.role = 'Driver' AND u.status = 'Active' AND NOT EXISTS (SELECT 1 FROM trips t WHERE t.driver_id = u.id AND t.status IN ('Assigned', 'In Progress'))`),
      pool.query(`SELECT COALESCE(SUM(liters), 0)::numeric(12,2) AS liters, COUNT(*)::int AS transactions FROM fuel_transactions WHERE fueled_date >= date_trunc('month', CURRENT_DATE)::date AND fueled_date < (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month')::date`),
      pool.query(`SELECT t.id AS trip_id, tr.id AS request_id, e.name AS employee_name, dep.name AS department,
                         COALESCE(tr.destination, (SELECT tc.location FROM trip_checkpoints tc WHERE tc.trip_request_id = tr.id ORDER BY tc.sequence_order DESC LIMIT 1)) AS destination,
                         tr.trip_type, tr.requested_at, v.plate_number, v.brand_name, v.model_name, v.model_year,
                         dr.name AS driver_name, t.status,
                         (SELECT COUNT(*)::int FROM trip_checkpoints tc WHERE tc.trip_request_id = tr.id) AS checkpoint_count
                    FROM trips t
                    JOIN trip_requests tr ON tr.id = t.trip_request_id
                    JOIN employees e ON e.id = tr.employee_id
                    LEFT JOIN departments dep ON dep.id = e.department_id
                    JOIN vehicles v ON v.id = t.vehicle_id
                    JOIN users dr ON dr.id = t.driver_id
                   ORDER BY tr.requested_at DESC, tr.id DESC
                   LIMIT 5`),
    ]);
    res.json({
      pendingRequests: requests.rows[0].pending,
      activeTrips: trips.rows[0].active,
      availableVehicles: vehicles.rows[0].available,
      availableDrivers: drivers.rows[0].available,
      fuelThisMonth: Number(fuel.rows[0].liters),
      fuelTransactionsThisMonth: fuel.rows[0].transactions,
      trips: recent.rows,
      refreshedAt: new Date().toISOString(),
    });
  } catch (err) { next(err); }
}

module.exports = { getDashboard };
