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
        ftx.liters, ftx.status, v.id AS vehicle_id, v.plate_number,
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

module.exports = { listFuelLogs };
