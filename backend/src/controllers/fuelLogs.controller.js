const pool = require('../db/pool');

async function listFuelLogs(req, res, next) {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize, 10) || 8));
  const q = String(req.query.q || '').trim().slice(0, 100);
  const vehicleId = String(req.query.vehicleId || 'all');
  const fuelTypeId = String(req.query.fuelTypeId || 'all');
  const period = String(req.query.period || '30days');
  const params = [];
  const where = [];
  const add = (value) => { params.push(value); return `$${params.length}`; };

  if (q) {
    const p = add(`%${q.replace(/[\\%_]/g, '\\$&')}%`);
    where.push(`(ftx.transaction_ref ILIKE ${p} OR v.plate_number ILIKE ${p}
      OR v.brand_name ILIKE ${p} OR v.model_name ILIKE ${p}
      OR CAST(v.model_year AS TEXT) ILIKE ${p})`);
  }
  if (vehicleId !== 'all' && Number.isInteger(Number(vehicleId)) && Number(vehicleId) > 0) {
    where.push(`v.id = ${add(Number(vehicleId))}`);
  }
  if (fuelTypeId !== 'all' && Number.isInteger(Number(fuelTypeId)) && Number(fuelTypeId) > 0) {
    where.push(`ftx.fuel_type_id = ${add(Number(fuelTypeId))}`);
  }
  if (period === '30days') where.push(`ftx.fueled_date >= CURRENT_DATE - INTERVAL '29 days'`);
  else if (period === '7days') where.push(`ftx.fueled_date >= CURRENT_DATE - INTERVAL '6 days'`);
  else if (period === 'thisMonth') where.push(`ftx.fueled_date >= date_trunc('month', CURRENT_DATE)`);
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const from = `FROM fuel_transactions ftx
    JOIN vehicles v ON v.id = ftx.vehicle_id
    LEFT JOIN fuel_types ft ON ft.id = ftx.fuel_type_id
    JOIN users u ON u.id = ftx.recorded_by_user_id`;

  try {
    const [countResult, statsResult, vehiclesResult, fuelTypesResult] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS total ${from} ${clause}`, params),
      pool.query(`SELECT
        COALESCE(SUM(liters) FILTER (WHERE fueled_date >= date_trunc('month', CURRENT_DATE)), 0)::numeric(12,2) AS liters_this_month,
        COUNT(*) FILTER (WHERE fueled_date >= date_trunc('month', CURRENT_DATE))::int AS transactions_this_month,
        COUNT(*)::int AS total_transactions
        FROM fuel_transactions`),
      pool.query(`SELECT v.id, v.plate_number, v.brand_name, v.model_name, v.model_year
        FROM vehicles v ORDER BY v.plate_number`),
      pool.query(`SELECT id, name FROM fuel_types ORDER BY name`)
    ]);
    const total = countResult.rows[0].total;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const currentPage = Math.min(page, totalPages);
    const rowsResult = await pool.query(
      `SELECT ftx.id, ftx.fueled_date, ftx.recorded_at, ftx.transaction_ref,
        ftx.liters, ftx.price_per_liter, ftx.energy_kwh, ftx.price_per_kwh, COALESCE(ftx.energy_kwh, ftx.liters) AS quantity, CASE WHEN ftx.energy_kwh IS NOT NULL THEN 'kWh' ELSE 'L' END AS quantity_unit, (COALESCE(ftx.energy_kwh * ftx.price_per_kwh, ftx.liters * ftx.price_per_liter))::numeric(14,2) AS total_cost, ftx.status, v.id AS vehicle_id, v.plate_number,
        v.brand_name, v.model_name, v.model_year, ft.name AS fuel_type,
        u.name AS recorded_by
       ${from} ${clause}
       ORDER BY ftx.fueled_date DESC, ftx.recorded_at DESC, ftx.id DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, pageSize, (currentPage - 1) * pageSize]
    );
    res.json({
      transactions: rowsResult.rows,
      total,
      page: currentPage,
      pageSize,
      totalPages,
      stats: statsResult.rows[0],
      vehicles: vehiclesResult.rows,
      fuelTypes: fuelTypesResult.rows
    });
  } catch (err) {
    next(err);
  }
}


async function getFuelOptions(req, res, next) {
  try {
    const [vehicles, fuelTypes] = await Promise.all([
      pool.query(`SELECT v.id, v.plate_number, v.brand_name, v.model_name, v.model_year, vt.name AS vehicle_type
        FROM vehicles v LEFT JOIN vehicle_types vt ON vt.id = v.vehicle_type_id
        WHERE v.status = 'Active' ORDER BY v.plate_number`),
      pool.query('SELECT id, name FROM fuel_types ORDER BY name')
    ]);
    res.json({ vehicles: vehicles.rows, fuelTypes: fuelTypes.rows });
  } catch (err) { next(err); }
}

async function createFuelTransaction(req, res, next) {
  const vehicleId = Number(req.body.vehicleId), fuelTypeId = Number(req.body.fuelTypeId);
  const date = String(req.body.fueledDate || '');
  if (!Number.isSafeInteger(vehicleId) || vehicleId < 1) return res.status(400).json({ error: 'Select a valid vehicle.' });
  if (!Number.isSafeInteger(fuelTypeId) || fuelTypeId < 1) return res.status(400).json({ error: 'Select a valid fuel or energy type.' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) return res.status(400).json({ error: 'Enter a valid fueling date.' });
  try {
    const [vehicle, fuel] = await Promise.all([
      pool.query("SELECT id FROM vehicles WHERE id = $1 AND status = 'Active'", [vehicleId]),
      pool.query('SELECT id, name FROM fuel_types WHERE id = $1', [fuelTypeId])
    ]);
    if (!vehicle.rowCount) return res.status(400).json({ error: 'Selected vehicle is not active or does not exist.' });
    if (!fuel.rowCount) return res.status(400).json({ error: 'Selected fuel or energy type does not exist.' });
    const isElectric = /electric/i.test(fuel.rows[0].name || '');
    const quantity = Number(isElectric ? req.body.kwh : req.body.liters);
    const price = Number(isElectric ? req.body.pricePerKwh : req.body.pricePerLiter);
    if (!Number.isFinite(quantity) || quantity <= 0) return res.status(400).json({ error: isElectric ? 'Energy charged must be greater than zero.' : 'Quantity must be greater than zero.' });
    if (!Number.isFinite(price) || price < 0) return res.status(400).json({ error: isElectric ? 'Price per kWh cannot be negative.' : 'Price per liter cannot be negative.' });
    const ref = `${isElectric ? 'CHG' : 'FUEL'}-${date.slice(0,4)}-${Date.now()}-${Math.floor(Math.random()*10000).toString().padStart(4,'0')}`;
    const saved = await pool.query(
      `INSERT INTO fuel_transactions (vehicle_id, fueled_date, fuel_type_id, liters, price_per_liter, energy_kwh, price_per_kwh, transaction_ref, recorded_by_user_id)
       VALUES ($1, $2::date, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, fueled_date, liters, price_per_liter, energy_kwh, price_per_kwh, transaction_ref, recorded_at`,
      [vehicleId, date, fuelTypeId, isElectric ? null : quantity, isElectric ? null : price, isElectric ? quantity : null, isElectric ? price : null, ref, req.user.id]
    );
    res.status(201).json({ transaction: saved.rows[0], totalCost: Number((quantity * price).toFixed(2)), unit: isElectric ? 'kWh' : 'L' });
  } catch (err) { next(err); }
}

module.exports = { listFuelLogs, getFuelOptions, createFuelTransaction };

