const pool = require('../db/pool');

/**
 * Read-only fleet registry. Availability is derived from the vehicle's
 * operational status and any trip currently Assigned or In Progress.
 * This deliberately uses the existing schema; no migration is needed.
 */
async function listVehicles(req, res, next) {
  try {
    const { rows } = await pool.query(
      `SELECT
          v.id,
          v.plate_number,
          v.brand_name,
          v.model_name,
          v.model_year,
          v.status AS vehicle_status,
          vt.name AS vehicle_type,
          ft.name AS fuel_type,
          active_trip.destination AS current_trip_destination,
          active_trip.trip_id AS current_trip_id,
          CASE
            WHEN v.status = 'Out of Service' THEN 'Out of Service'
            WHEN v.status = 'Returned to Provider' THEN 'Returned to Provider'
            WHEN active_trip.trip_id IS NOT NULL THEN 'In Use'
            WHEN v.status = 'Active' THEN 'Available'
            ELSE v.status
          END AS operational_status
        FROM vehicles v
        LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
        LEFT JOIN fuel_types ft ON ft.id = v.fuel_type_id
        LEFT JOIN LATERAL (
          SELECT t.id AS trip_id, tr.destination
            FROM trips t
            JOIN trip_requests tr ON tr.id = t.trip_request_id
           WHERE t.vehicle_id = v.id
             AND t.status IN ('Assigned', 'In Progress')
           ORDER BY t.assigned_at DESC, t.id DESC
           LIMIT 1
        ) active_trip ON TRUE
        ORDER BY v.id ASC`
    );

    const summary = rows.reduce((counts, vehicle) => {
      counts.total += 1;
      if (vehicle.operational_status === 'Available') counts.available += 1;
      if (vehicle.operational_status === 'In Use') counts.inUse += 1;
      if (!['Available', 'In Use'].includes(vehicle.operational_status)) counts.unavailable += 1;
      return counts;
    }, { total: 0, available: 0, inUse: 0, unavailable: 0 });

    res.json({ vehicles: rows, summary, refreshedAt: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
}


const parseVehicleId = (value) => {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

/**
 * Vehicle detail view: current operational assignment and recent trips.
 * Uses existing tables only; origin is not stored in the current schema.
 */
async function getVehicleDetails(req, res, next) {
  const vehicleId = parseVehicleId(req.params.vehicleId);
  if (!vehicleId) return res.status(400).json({ error: 'Invalid vehicle ID.' });

  try {
    const vehicleResult = await pool.query(
      `SELECT
          v.id,
          v.plate_number,
          v.brand_name,
          v.model_name,
          v.model_year,
          v.fuel_efficiency_km_per_l,
          v.energy_consumption_kwh_per_100km,
          v.status AS vehicle_status,
          vt.name AS vehicle_type,
          ft.name AS fuel_type,
          active_trip.trip_id AS current_trip_id,
          active_trip.destination AS current_trip_destination,
          active_trip.employee_name AS current_trip_employee,
          active_trip.trip_status AS current_trip_status,
          active_trip.assigned_at AS current_trip_assigned_at,
          active_trip.started_at AS current_trip_started_at,
          CASE
            WHEN v.status = 'Out of Service' THEN 'Out of Service'
            WHEN v.status = 'Returned to Provider' THEN 'Returned to Provider'
            WHEN active_trip.trip_id IS NOT NULL THEN 'In Use'
            WHEN v.status = 'Active' THEN 'Available'
            ELSE v.status
          END AS operational_status
        FROM vehicles v
        LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
        LEFT JOIN fuel_types ft ON ft.id = v.fuel_type_id
        LEFT JOIN LATERAL (
          SELECT t.id AS trip_id, tr.destination, e.name AS employee_name,
                 t.status AS trip_status, t.assigned_at, t.started_at
            FROM trips t
            JOIN trip_requests tr ON tr.id = t.trip_request_id
            JOIN employees e ON e.id = tr.employee_id
           WHERE t.vehicle_id = v.id
             AND t.status IN ('Assigned', 'In Progress')
           ORDER BY t.assigned_at DESC, t.id DESC
           LIMIT 1
        ) active_trip ON TRUE
        WHERE v.id = $1`,
      [vehicleId]
    );

    if (!vehicleResult.rowCount) {
      return res.status(404).json({ error: 'Vehicle not found.' });
    }

    const recentTripsResult = await pool.query(
      `SELECT
          t.id AS trip_id,
          tr.destination,
          e.name AS employee_name,
          t.status AS trip_status,
          t.assigned_at,
          t.started_at,
          t.completed_at,
          COALESCE(t.completed_at, t.started_at, t.assigned_at) AS activity_at
        FROM trips t
        JOIN trip_requests tr ON tr.id = t.trip_request_id
        JOIN employees e ON e.id = tr.employee_id
       WHERE t.vehicle_id = $1
       ORDER BY COALESCE(t.completed_at, t.started_at, t.assigned_at) DESC, t.id DESC
       LIMIT 10`,
      [vehicleId]
    );

    const recentFuelLogsResult = await pool.query(
      `SELECT
          f.id AS fuel_transaction_id,
          f.fueled_date,
          f.liters,
          f.energy_kwh,
          COALESCE(f.energy_kwh, f.liters) AS quantity,
          CASE WHEN f.energy_kwh IS NOT NULL THEN 'kWh' ELSE 'L' END AS quantity_unit,
          f.transaction_ref,
          f.status AS fuel_status,
          f.recorded_at,
          ft.name AS fuel_type,
          u.name AS recorded_by
        FROM fuel_transactions f
        LEFT JOIN fuel_types ft ON ft.id = f.fuel_type_id
        LEFT JOIN users u ON u.id = f.recorded_by_user_id
       WHERE f.vehicle_id = $1
       ORDER BY f.fueled_date DESC, f.recorded_at DESC, f.id DESC
       LIMIT 10`,
      [vehicleId]
    );

    const recentMaintenanceResult = await pool.query(
      `SELECT
          m.id AS maintenance_record_id,
          m.maintenance_type,
          m.cost,
          m.status AS maintenance_status,
          m.maintenance_at,
          m.recorded_at,
          u.name AS recorded_by
        FROM vehicle_maintenance_records m
        LEFT JOIN users u ON u.id = m.recorded_by_user_id
       WHERE m.vehicle_id = $1
       ORDER BY m.maintenance_at DESC, m.recorded_at DESC, m.id DESC
       LIMIT 10`,
      [vehicleId]
    );

    res.json({
      vehicle: vehicleResult.rows[0],
      recentTrips: recentTripsResult.rows,
      recentFuelLogs: recentFuelLogsResult.rows,
      recentMaintenance: recentMaintenanceResult.rows,
      refreshedAt: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { listVehicles, getVehicleDetails };

