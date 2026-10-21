const pool = require('../db/pool');

const clean = (v, max = 100) => typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '';
const positiveInt = (v) => { const n = Number(v); return Number.isSafeInteger(n) && n > 0 ? n : null; };
const validStatuses = ['Active', 'Out of Service', 'Returned to Provider'];
const parseId = (v) => positiveInt(v);

const vehicleSelect = `
  SELECT v.id, v.plate_number, v.brand_name, v.model_name, v.model_year, v.fuel_efficiency_km_per_l,
         v.status AS vehicle_status, vt.id AS vehicle_type_id, vt.name AS vehicle_type,
         ft.id AS fuel_type_id, ft.name AS fuel_type,
         active_trip.trip_id AS current_trip_id,
         active_trip.driver_name AS current_driver,
         CASE WHEN v.status = 'Out of Service' THEN 'Maintenance'
              WHEN v.status = 'Returned to Provider' THEN 'Inactive'
              WHEN active_trip.trip_id IS NOT NULL THEN 'On Trip'
              WHEN v.status = 'Active' THEN 'Available'
              ELSE v.status END AS operational_status
    FROM vehicles v
    LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
    LEFT JOIN fuel_types ft ON ft.id = v.fuel_type_id
    LEFT JOIN LATERAL (
      SELECT t.id AS trip_id, u.name AS driver_name
        FROM trips t JOIN users u ON u.id = t.driver_id
       WHERE t.vehicle_id = v.id AND t.status IN ('Assigned', 'In Progress')
       ORDER BY t.assigned_at DESC, t.id DESC LIMIT 1
    ) active_trip ON TRUE`;

async function listAdminVehicles(req, res, next) {
  try {
    const { rows } = await pool.query(`${vehicleSelect} ORDER BY COALESCE(v.brand_name, ''), COALESCE(v.model_name, ''), v.plate_number`);
    const summary = rows.reduce((s, v) => {
      s.total += 1;
      if (v.operational_status === 'Available') s.available += 1;
      else if (v.operational_status === 'On Trip') s.onTrip += 1;
      else s.unavailable += 1;
      if (v.operational_status === 'Maintenance') s.maintenance += 1;
      if (v.operational_status === 'Inactive') s.inactive += 1;
      return s;
    }, { total: 0, available: 0, onTrip: 0, unavailable: 0, maintenance: 0, inactive: 0 });
    res.json({ vehicles: rows, summary, refreshedAt: new Date().toISOString() });
  } catch (err) { next(err); }
}

async function getVehicleOptions(req, res, next) {
  try {
    const [types, fuels] = await Promise.all([
      pool.query('SELECT id, name FROM vehicle_types ORDER BY name'),
      pool.query('SELECT id, name FROM fuel_types ORDER BY name'),
    ]);
    res.json({ vehicleTypes: types.rows, fuelTypes: fuels.rows });
  } catch (err) { next(err); }
}

async function getAdminVehicle(req, res, next) {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid vehicle ID.' });
  try {
    const result = await pool.query(`${vehicleSelect} WHERE v.id = $1`, [id]);
    if (!result.rowCount) return res.status(404).json({ error: 'Vehicle not found.' });
    const trips = await pool.query(`SELECT t.id, tr.destination, u.name AS driver_name, t.status, t.assigned_at, t.started_at, t.completed_at
      FROM trips t JOIN trip_requests tr ON tr.id=t.trip_request_id JOIN users u ON u.id=t.driver_id
      WHERE t.vehicle_id=$1 ORDER BY COALESCE(t.completed_at,t.started_at,t.assigned_at) DESC, t.id DESC LIMIT 10`, [id]);
    const fuel = await pool.query(`SELECT f.id, f.transaction_ref, f.fueled_date, f.liters, f.status, ft.name AS fuel_type
      FROM fuel_transactions f LEFT JOIN fuel_types ft ON ft.id=f.fuel_type_id
      WHERE f.vehicle_id=$1 ORDER BY f.fueled_date DESC, f.recorded_at DESC LIMIT 10`, [id]);
    res.json({ vehicle: result.rows[0], trips: trips.rows, fuelLogs: fuel.rows });
  } catch (err) { next(err); }
}

function validate(body = {}, partial = false) {
  const fields = {}; const value = {};
  const has = (k) => Object.prototype.hasOwnProperty.call(body, k);
  if (!partial || has('plateNumber')) {
    value.plateNumber = clean(body.plateNumber, 20).toUpperCase();
    if (!value.plateNumber) fields.plateNumber = 'Plate number is required.';
  }
  for (const [key, label, max] of [['brandName', 'Brand / make', 80], ['modelName', 'Model', 80]]) {
    if (!partial || has(key)) { value[key] = clean(body[key], max); if (!value[key]) fields[key] = `${label} is required.`; }
  }
  if (!partial || has('modelYear')) {
    const raw = body.modelYear;
    value.modelYear = raw === '' || raw === null || raw === undefined ? null : Number(raw);
    if (value.modelYear !== null && (!Number.isInteger(value.modelYear) || value.modelYear < 1900 || value.modelYear > 2100)) fields.modelYear = 'Enter a year between 1900 and 2100.';
  }
  if (!partial || has('fuelEfficiencyKmPerL')) {
    const raw = body.fuelEfficiencyKmPerL;
    value.fuelEfficiencyKmPerL = raw === '' || raw === null || raw === undefined ? null : Number(raw);
    if (value.fuelEfficiencyKmPerL === null || !Number.isFinite(value.fuelEfficiencyKmPerL) || value.fuelEfficiencyKmPerL <= 0 || value.fuelEfficiencyKmPerL > 100) {
      fields.fuelEfficiencyKmPerL = 'Enter fuel efficiency greater than 0 and no more than 100 km/L.';
    }
  }
  for (const [key, label] of [['vehicleTypeId', 'vehicle type'], ['fuelTypeId', 'fuel type']]) {
    if (!partial || has(key)) {
      const raw = body[key]; value[key] = raw === '' || raw === null || raw === undefined ? null : positiveInt(raw);
      if (!value[key]) fields[key] = `Choose a valid ${label}.`;
    }
  }
  if (!partial || has('status')) {
    value.status = body.status || 'Active';
    if (!validStatuses.includes(value.status)) fields.status = 'Choose a valid vehicle status.';
  }
  return { fields, value };
}

function uniqueViolation(err) { return err && err.code === '23505'; }
function foreignKeyViolation(err) { return err && err.code === '23503'; }

async function createAdminVehicle(req, res, next) {
  const { fields, value } = validate(req.body);
  if (Object.keys(fields).length) return res.status(400).json({ error: 'Please correct the highlighted fields.', fields });
  try {
    const { rows } = await pool.query(`INSERT INTO vehicles (plate_number, brand_name, model_name, model_year, fuel_efficiency_km_per_l, vehicle_type_id, fuel_type_id, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`, [value.plateNumber, value.brandName, value.modelName, value.modelYear, value.fuelEfficiencyKmPerL, value.vehicleTypeId, value.fuelTypeId, value.status]);
    const created = await pool.query(`${vehicleSelect} WHERE v.id=$1`, [rows[0].id]);
    res.status(201).json({ vehicle: created.rows[0] });
  } catch (err) {
    if (uniqueViolation(err)) return res.status(409).json({ error: 'A vehicle with that plate number already exists.', fields: { plateNumber: 'Plate number must be unique.' } });
    if (foreignKeyViolation(err)) return res.status(400).json({ error: 'The selected vehicle type or fuel type is no longer available.' });
    next(err);
  }
}

async function updateAdminVehicle(req, res, next) {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid vehicle ID.' });
  const { fields, value } = validate(req.body, true);
  if (Object.keys(fields).length) return res.status(400).json({ error: 'Please correct the highlighted fields.', fields });
  const map = { plateNumber: 'plate_number', brandName: 'brand_name', modelName: 'model_name', modelYear: 'model_year', fuelEfficiencyKmPerL: 'fuel_efficiency_km_per_l', vehicleTypeId: 'vehicle_type_id', fuelTypeId: 'fuel_type_id', status: 'status' };
  const entries = Object.keys(map).filter((key) => Object.hasOwn(value, key));
  if (!entries.length) return res.status(400).json({ error: 'No vehicle changes were supplied.' });
  try {
    const values = entries.map((key) => value[key]);
    const sets = entries.map((key, i) => `${map[key]}=$${i + 1}`);
    values.push(id);
    const update = await pool.query(`UPDATE vehicles SET ${sets.join(', ')} WHERE id=$${values.length} RETURNING id`, values);
    if (!update.rowCount) return res.status(404).json({ error: 'Vehicle not found.' });
    const result = await pool.query(`${vehicleSelect} WHERE v.id=$1`, [id]);
    res.json({ vehicle: result.rows[0] });
  } catch (err) {
    if (uniqueViolation(err)) return res.status(409).json({ error: 'A vehicle with that plate number already exists.', fields: { plateNumber: 'Plate number must be unique.' } });
    if (foreignKeyViolation(err)) return res.status(400).json({ error: 'The selected vehicle type or fuel type is no longer available.' });
    next(err);
  }
}

async function updateAdminVehicleStatus(req, res, next) {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid vehicle ID.' });
  const { status } = req.body || {};
  if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Choose Active, Out of Service, or Returned to Provider.' });
  try {
    if (status === 'Returned to Provider') {
      const active = await pool.query(`SELECT 1 FROM trips WHERE vehicle_id=$1 AND status IN ('Assigned','In Progress') LIMIT 1`, [id]);
      if (active.rowCount) return res.status(409).json({ error: 'This vehicle has an active trip. Complete or cancel the trip before deactivating it.' });
    }
    const result = await pool.query('UPDATE vehicles SET status=$1 WHERE id=$2 RETURNING id', [status, id]);
    if (!result.rowCount) return res.status(404).json({ error: 'Vehicle not found.' });
    const vehicle = await pool.query(`${vehicleSelect} WHERE v.id=$1`, [id]);
    res.json({ vehicle: vehicle.rows[0] });
  } catch (err) { next(err); }
}

module.exports = { listAdminVehicles, getVehicleOptions, getAdminVehicle, createAdminVehicle, updateAdminVehicle, updateAdminVehicleStatus };
