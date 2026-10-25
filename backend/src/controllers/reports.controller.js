const pool = require('../db/pool');

const PERIOD_REPORTS = new Set(['driver-trip-summary','driver-trip-history','vehicle-utilization','maintenance-cost','fuel-consumption','fuel-cost-summary','expected-vs-actual']);
const REPORTS = {
  'user-directory': { title: 'User directory', subtitle: 'Accounts, roles, contact details and access status.' },
  'accounts-by-role': { title: 'Accounts by role and status', subtitle: 'Active and inactive accounts grouped by role.' },
  'driver-directory': { title: 'Driver directory', subtitle: 'Driver contact details and current availability.' },
  'driver-trip-summary': { title: 'Driver trip summary', subtitle: 'Trip counts, outcomes and recorded distance by driver.' },
  'driver-trip-history': { title: 'Driver trip history', subtitle: 'Trip-by-trip history for a selected driver.' },
  'fleet-register': { title: 'Fleet register', subtitle: 'Vehicle details, fuel type, capacity and rated efficiency.' },
  'vehicle-utilization': { title: 'Vehicle utilization', subtitle: 'Trip activity and recorded distance by vehicle.' },
  'maintenance-cost': { title: 'Maintenance cost', subtitle: 'Service, repair and inspection costs by vehicle.' },
  'fuel-consumption': { title: 'Fuel consumption by vehicle', subtitle: 'Recorded liquid fuel and electric energy, kept in separate units.' },
  'fuel-cost-summary': { title: 'Fuel cost summary', subtitle: 'Recorded fuel and charging costs grouped by vehicle, fuel type or month.' },
  'expected-vs-actual': { title: 'Expected vs actual consumption', subtitle: 'Rated-efficiency estimates compared with fuel or energy purchased in the selected period.' },
};

const str = (v) => typeof v === 'string' ? v.trim() : '';
const validDate = (v) => { if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false; const d = new Date(`${v}T00:00:00Z`); return !Number.isNaN(d.getTime()) && d.toISOString().slice(0,10) === v; };
const validId = (v) => v !== '' && v != null && Number.isSafeInteger(Number(v)) && Number(v) > 0 ? Number(v) : null;
const escapeHtml = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));

function parseFilters(query, key) {
  const today = new Date();
  if (str(query.startDate) && !validDate(str(query.startDate))) return { error: 'Enter a valid start date.' };
  if (str(query.endDate) && !validDate(str(query.endDate))) return { error: 'Enter a valid end date.' };
  const end = validDate(str(query.endDate)) ? str(query.endDate) : today.toISOString().slice(0, 10);
  const fallbackStart = new Date(`${end}T00:00:00Z`);
  fallbackStart.setUTCDate(fallbackStart.getUTCDate() - 29);
  const start = validDate(str(query.startDate)) ? str(query.startDate) : fallbackStart.toISOString().slice(0, 10);
  if (start > end) return { error: 'Start date must be on or before the end date.' };
  if ((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000 > 3660) return { error: 'Choose a date range of 10 years or less.' };
  const role = str(query.role);
  const status = str(query.status);
  const availability = str(query.availability);
  const vehicleTypeId = str(query.vehicleTypeId);
  const fuelTypeId = str(query.fuelTypeId);
  const vehicleId = str(query.vehicleId);
  const driverId = str(query.driverId);
  const groupBy = ['vehicle', 'fuelType', 'month'].includes(str(query.groupBy)) ? str(query.groupBy) : 'vehicle';
  if (['user-directory'].includes(key) && role && !['Manager', 'Driver', 'System Administrator'].includes(role)) return { error: 'Choose a valid role.' };
  if (status && !['Active', 'Inactive', 'Out of Service', 'Returned to Provider'].includes(status)) return { error: 'Choose a valid status.' };
  if (availability && !['Available', 'On trip', 'Inactive'].includes(availability)) return { error: 'Choose a valid availability.' };
  for (const [name, value] of [['vehicleTypeId', vehicleTypeId], ['fuelTypeId', fuelTypeId], ['vehicleId', vehicleId], ['driverId', driverId]]) {
    if (value && value !== 'all' && !validId(value)) return { error: `Invalid ${name} filter.` };
  }
  if (key === 'driver-trip-history' && !validId(driverId)) return { error: 'Choose a driver to generate this report.' };
  return { start, end, role, status, availability, vehicleTypeId, fuelTypeId, vehicleId, driverId, groupBy };
}

async function queryReport(key, f) {
  const params = [];
  const add = (v) => { params.push(v); return `$${params.length}`; };
  const period = (column) => `${column}::date >= ${add(f.start)}::date AND ${column}::date <= ${add(f.end)}::date`;
  let columns = [], rows = [], summary = [], notes = [];
  const vehicleLabel = `concat_ws(' ', NULLIF(v.brand_name,''), NULLIF(v.model_name,''))`;
  const vehicleName = `CASE WHEN ${vehicleLabel} <> '' THEN ${vehicleLabel} || E'\\n' || v.plate_number ELSE v.plate_number END`;
  switch (key) {
    case 'user-directory': {
      const where = [];
      if (f.role) where.push(`u.role = ${add(f.role)}`);
      if (f.status) where.push(`u.status = ${add(f.status)}`);
      const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const result = await pool.query(`SELECT u.name, COALESCE(u.username,'—') AS username, u.role, COALESCE(u.phone,'—') AS phone, u.status FROM users u ${w} ORDER BY LOWER(u.name), u.id`, params);
      columns = ['Name','Username','Role','Phone','Status']; rows = result.rows.map(r => [r.name,r.username,r.role,r.phone,r.status]);
      summary = [{label:'Accounts',value:rows.length}]; break;
    }
    case 'accounts-by-role': {
      const result = await pool.query(`SELECT role, COUNT(*) FILTER (WHERE status='Active')::int AS active, COUNT(*) FILTER (WHERE status='Inactive')::int AS inactive, COUNT(*)::int AS total FROM users GROUP BY role ORDER BY role`);
      columns = ['Role','Active','Inactive','Total']; rows = result.rows.map(r => [r.role,r.active,r.inactive,r.total]);
      summary = [{label:'Accounts',value:result.rows.reduce((n,r)=>n+r.total,0)},{label:'Active',value:result.rows.reduce((n,r)=>n+r.active,0)},{label:'Inactive',value:result.rows.reduce((n,r)=>n+r.inactive,0)}]; break;
    }
    case 'driver-directory': {
      const result = await pool.query(`SELECT u.name, COALESCE(u.phone,'—') AS phone, CASE WHEN u.status <> 'Active' THEN 'Inactive' WHEN t.id IS NOT NULL THEN 'On trip' ELSE 'Available' END AS availability, COALESCE('Trip #' || t.id::text,'—') AS current_trip FROM users u LEFT JOIN LATERAL (SELECT id FROM trips WHERE driver_id=u.id AND status IN ('Assigned','In Progress') ORDER BY assigned_at DESC LIMIT 1) t ON TRUE WHERE u.role='Driver' AND ($1::text='' OR CASE WHEN u.status <> 'Active' THEN 'Inactive' WHEN t.id IS NOT NULL THEN 'On trip' ELSE 'Available' END=$1) ORDER BY LOWER(u.name)`, [f.availability]);
      columns = ['Name','Phone','Availability','Current trip']; rows = result.rows.map(r => [r.name,r.phone,r.availability,r.current_trip]); summary = [{label:'Drivers',value:rows.length}]; break;
    }
    case 'driver-trip-summary': {
      const result = await pool.query(`SELECT d.name AS driver, COUNT(t.id)::int AS trips, COUNT(t.id) FILTER (WHERE t.status='Completed')::int AS completed, COUNT(t.id) FILTER (WHERE t.status='Cancelled')::int AS cancelled, ROUND(SUM(t.distance_km) FILTER (WHERE t.distance_km IS NOT NULL),2) AS distance_km, COUNT(t.id) FILTER (WHERE t.status='Completed' AND t.distance_km IS NULL)::int AS missing_distance FROM users d LEFT JOIN trips t ON t.driver_id=d.id AND t.assigned_at::date >= $1::date AND t.assigned_at::date <= $2::date WHERE d.role='Driver' AND ($3::text='' OR d.id=NULLIF($3,'')::int) GROUP BY d.id,d.name ORDER BY LOWER(d.name)`, [f.start,f.end,f.driverId]);
      columns = ['Driver','Trips','Completed','Cancelled','Distance (km)','Trips without distance']; rows = result.rows.map(r => [r.driver,r.trips,r.completed,r.cancelled,r.distance_km ?? '—',r.missing_distance]);
      summary = [{label:'Trips',value:result.rows.reduce((n,r)=>n+r.trips,0)},{label:'Completed',value:result.rows.reduce((n,r)=>n+r.completed,0)},{label:'Trips without distance',value:result.rows.reduce((n,r)=>n+r.missing_distance,0)}];
      const missing = summary[2].value; if (missing) notes.push(`${missing} completed trips have no distance recorded; these are excluded from distance totals.`); break;
    }
    case 'driver-trip-history': {
      const result = await pool.query(`SELECT t.assigned_at::date AS trip_date, 'Trip #'||t.id::text AS trip, concat_ws(' → ', NULLIF(tr.origin,''), NULLIF(tr.destination,'')) AS route, COALESCE(${vehicleLabel} || ' · ' || v.plate_number,v.plate_number) AS vehicle, t.status, t.distance_km FROM trips t JOIN trip_requests tr ON tr.id=t.trip_request_id JOIN vehicles v ON v.id=t.vehicle_id JOIN users d ON d.id=t.driver_id WHERE t.driver_id=${add(Number(f.driverId))} AND ${period('t.assigned_at')} ORDER BY t.assigned_at DESC,t.id DESC`, params);
      columns = ['Date','Trip','Route','Vehicle','Status','Distance (km)']; rows = result.rows.map(r => [r.trip_date,r.trip,r.route || '—',r.vehicle,r.status,r.distance_km ?? '—']);
      summary = [{label:'Trips',value:rows.length},{label:'Distance recorded (km)',value:result.rows.reduce((n,r)=>n+(Number(r.distance_km)||0),0).toFixed(2)},{label:'Trips without distance',value:result.rows.filter(r=>r.distance_km==null).length}];
      if (summary[2].value) notes.push(`${summary[2].value} trips have no distance recorded; they are excluded from the distance total.`); break;
    }
    case 'fleet-register': {
      const where = [], p = [];
      if (f.status) { p.push(f.status); where.push(`v.status=$${p.length}`); }
      if (f.vehicleTypeId && f.vehicleTypeId !== 'all') { p.push(Number(f.vehicleTypeId)); where.push(`v.vehicle_type_id=$${p.length}`); }
      if (f.fuelTypeId && f.fuelTypeId !== 'all') { p.push(Number(f.fuelTypeId)); where.push(`v.fuel_type_id=$${p.length}`); }
      const result = await pool.query(`SELECT ${vehicleName} AS vehicle, COALESCE(vt.name,'—') AS type, COALESCE(ft.name,'—') AS fuel, COALESCE(v.seat_capacity::text,'—') AS seats, CASE WHEN v.energy_consumption_kwh_per_100km IS NOT NULL THEN v.energy_consumption_kwh_per_100km::text || ' kWh/100 km' WHEN v.fuel_efficiency_km_per_l IS NOT NULL THEN v.fuel_efficiency_km_per_l::text || ' km/L' ELSE 'n/a' END AS efficiency, v.status FROM vehicles v LEFT JOIN vehicle_types vt ON vt.id=v.vehicle_type_id LEFT JOIN fuel_types ft ON ft.id=v.fuel_type_id ${where.length?'WHERE '+where.join(' AND '):''} ORDER BY v.plate_number`, p);
      columns = ['Vehicle','Type','Fuel','Seats','Rated efficiency','Status']; rows = result.rows.map(r => [r.vehicle,r.type,r.fuel,r.seats,r.efficiency,r.status]); summary = [{label:'Vehicles',value:rows.length},{label:'Without rated efficiency',value:rows.filter(r=>r[4]==='n/a').length}]; break;
    }
    case 'vehicle-utilization': {
      const params = [f.start, f.end];
      let vehicleClause = '';
      if (f.vehicleId && f.vehicleId !== 'all') { params.push(Number(f.vehicleId)); vehicleClause = `WHERE v.id=$3`; }
      const result = await pool.query(`SELECT ${vehicleName} AS vehicle, COUNT(t.id)::int AS trips, COUNT(t.id) FILTER (WHERE t.status='Completed')::int AS completed, ROUND(SUM(t.distance_km) FILTER (WHERE t.distance_km IS NOT NULL),2) AS distance_km, COUNT(t.id) FILTER (WHERE t.distance_km IS NULL AND t.status='Completed')::int AS missing_distance FROM vehicles v LEFT JOIN trips t ON t.vehicle_id=v.id AND t.assigned_at::date >= $1::date AND t.assigned_at::date <= $2::date ${vehicleClause} GROUP BY v.id ORDER BY v.plate_number`, params);
      const filtered = result.rows;
      columns = ['Vehicle','Trips','Completed','Distance (km)','Completed trips without distance']; rows = filtered.map(r => [r.vehicle,r.trips,r.completed,r.distance_km ?? '—',r.missing_distance]);
      summary = [{label:'Trips',value:filtered.reduce((n,r)=>n+r.trips,0)},{label:'Distance recorded (km)',value:filtered.reduce((n,r)=>n+(Number(r.distance_km)||0),0).toFixed(2)},{label:'Trips without distance',value:filtered.reduce((n,r)=>n+r.missing_distance,0)}];
      if (summary[2].value) notes.push(`${summary[2].value} completed trips have no distance recorded; they are excluded from distance totals.`); break;
    }
    case 'maintenance-cost': {
      const result = await pool.query(`SELECT ${vehicleName} AS vehicle, m.maintenance_type, m.status, COUNT(*)::int AS records, ROUND(SUM(m.cost),2) AS cost FROM vehicle_maintenance_records m JOIN vehicles v ON v.id=m.vehicle_id WHERE m.maintenance_at::date >= $1::date AND m.maintenance_at::date <= $2::date AND m.status <> 'Cancelled' AND ($3::text='all' OR v.id=NULLIF($3,'all')::int) GROUP BY v.id,m.maintenance_type,m.status ORDER BY v.plate_number,m.maintenance_type`, [f.start,f.end,f.vehicleId||'all']);
      columns = ['Vehicle','Maintenance type','Status','Records','Cost']; rows = result.rows.map(r => [r.vehicle,r.maintenance_type,r.status,r.records,r.cost]);
      summary = [{label:'Records',value:result.rows.reduce((n,r)=>n+r.records,0)},{label:'Maintenance cost',value:result.rows.reduce((n,r)=>n+(Number(r.cost)||0),0).toFixed(2)}]; break;
    }
    case 'fuel-consumption': {
      const result = await pool.query(`SELECT ${vehicleName} AS vehicle, COALESCE(ft.name,'Unknown fuel type') AS fuel_type, COUNT(*)::int AS fillups, ROUND(SUM(f.liters),2) AS liters, ROUND(SUM(f.energy_kwh),2) AS energy_kwh, ROUND(SUM(COALESCE(f.liters*f.price_per_liter,0)+COALESCE(f.energy_kwh*f.price_per_kwh,0)),2) AS cost FROM fuel_transactions f JOIN vehicles v ON v.id=f.vehicle_id LEFT JOIN fuel_types ft ON ft.id=f.fuel_type_id WHERE ${period('f.fueled_date')} AND f.status IN ('Recorded','Verified') AND (${add(f.vehicleId||'all')}='all' OR v.id=NULLIF($${params.length},'all')::int) AND (${add(f.fuelTypeId||'all')}='all' OR f.fuel_type_id=NULLIF($${params.length},'all')::int) GROUP BY v.id,ft.name ORDER BY v.plate_number,ft.name`, [f.start,f.end,f.vehicleId||'all',f.fuelTypeId||'all']);
      columns = ['Vehicle','Fuel type','Fill-ups','Quantity (L)','Energy (kWh)','Cost']; rows = result.rows.map(r => [r.vehicle,r.fuel_type,r.fillups,r.liters ?? 0,r.energy_kwh ?? 0,r.cost]);
      summary = [{label:'Fill-ups / charges',value:result.rows.reduce((n,r)=>n+r.fillups,0)},{label:'Liquid fuel (L)',value:result.rows.reduce((n,r)=>n+(Number(r.liters)||0),0).toFixed(2)},{label:'Electric energy (kWh)',value:result.rows.reduce((n,r)=>n+(Number(r.energy_kwh)||0),0).toFixed(2)},{label:'Cost',value:result.rows.reduce((n,r)=>n+(Number(r.cost)||0),0).toFixed(2)}];
      notes.push('Litres and kWh are reported separately and are never added together. Flagged transactions are excluded from consumption and cost totals.'); break;
    }
    case 'fuel-cost-summary': {
      const groupExpr = f.groupBy === 'fuelType' ? `COALESCE(ft.name,'Unknown fuel type')` : f.groupBy === 'month' ? `to_char(date_trunc('month',f.fueled_date),'YYYY-MM')` : `COALESCE(NULLIF(${vehicleLabel},''),v.plate_number) || ' · ' || v.plate_number`;
      const result = await pool.query(`SELECT ${groupExpr} AS group_name, COUNT(*)::int AS transactions, ROUND(SUM(f.liters),2) AS liters, ROUND(SUM(f.energy_kwh),2) AS energy_kwh, ROUND(SUM(COALESCE(f.liters*f.price_per_liter,0)+COALESCE(f.energy_kwh*f.price_per_kwh,0)),2) AS cost FROM fuel_transactions f JOIN vehicles v ON v.id=f.vehicle_id LEFT JOIN fuel_types ft ON ft.id=f.fuel_type_id WHERE ${period('f.fueled_date')} AND f.status IN ('Recorded','Verified') GROUP BY group_name ORDER BY group_name`, [f.start,f.end]);
      columns = ['Group','Transactions','Quantity (L)','Energy (kWh)','Cost']; rows = result.rows.map(r => [r.group_name,r.transactions,r.liters ?? 0,r.energy_kwh ?? 0,r.cost]);
      summary = [{label:'Transactions',value:result.rows.reduce((n,r)=>n+r.transactions,0)},{label:'Liquid fuel (L)',value:result.rows.reduce((n,r)=>n+(Number(r.liters)||0),0).toFixed(2)},{label:'Electric energy (kWh)',value:result.rows.reduce((n,r)=>n+(Number(r.energy_kwh)||0),0).toFixed(2)},{label:'Cost',value:result.rows.reduce((n,r)=>n+(Number(r.cost)||0),0).toFixed(2)}];
      notes.push('Litres and kWh are shown separately. Flagged transactions are excluded from totals.'); break;
    }
    case 'expected-vs-actual': {
      const result = await pool.query(`WITH trip_totals AS (SELECT vehicle_id, SUM(distance_km) FILTER (WHERE distance_km IS NOT NULL) AS distance_km, COUNT(*) FILTER (WHERE distance_km IS NULL AND status='Completed')::int AS missing_distance FROM trips WHERE assigned_at::date >= $1::date AND assigned_at::date <= $2::date GROUP BY vehicle_id), fuel_totals AS (SELECT vehicle_id, SUM(liters) AS liters, SUM(energy_kwh) AS energy_kwh FROM fuel_transactions WHERE fueled_date >= $3::date AND fueled_date <= $4::date AND status IN ('Recorded','Verified') GROUP BY vehicle_id) SELECT ${vehicleName} AS vehicle, tt.distance_km, COALESCE(tt.missing_distance,0)::int AS missing_distance, CASE WHEN v.energy_consumption_kwh_per_100km IS NOT NULL AND tt.distance_km IS NOT NULL THEN ROUND(tt.distance_km*v.energy_consumption_kwh_per_100km/100,2) ELSE NULL END AS expected_kwh, CASE WHEN v.fuel_efficiency_km_per_l IS NOT NULL AND tt.distance_km IS NOT NULL THEN ROUND(tt.distance_km/v.fuel_efficiency_km_per_l,2) ELSE NULL END AS expected_liters, ft.liters AS actual_liters, ft.energy_kwh AS actual_kwh FROM vehicles v LEFT JOIN trip_totals tt ON tt.vehicle_id=v.id LEFT JOIN fuel_totals ft ON ft.vehicle_id=v.id WHERE ($5::text='all' OR v.id=NULLIF($5,'all')::int) ORDER BY v.plate_number`, [f.start,f.end,f.start,f.end,f.vehicleId||'all']);
      columns = ['Vehicle','Distance (km)','Expected (rated efficiency; L or kWh)','Actual purchased (L or kWh)','Difference (actual − expected)','Difference (%)'];
      rows = result.rows.map(r => { const electric = r.expected_kwh != null; const unit = electric ? 'kWh' : 'L'; const ev = electric ? Number(r.expected_kwh) : r.expected_liters != null ? Number(r.expected_liters) : null; const actual = ev == null ? null : electric ? (r.actual_kwh == null ? 0 : Number(r.actual_kwh)) : (r.actual_liters == null ? 0 : Number(r.actual_liters)); return [r.vehicle, r.distance_km == null ? 'n/a' : Number(r.distance_km), ev == null ? 'n/a' : `${ev} ${unit}`, actual == null ? 'n/a' : `${actual} ${unit}`, ev == null || actual == null ? 'n/a' : `${Number((actual-ev).toFixed(2))} ${unit}`, ev == null || actual == null || ev === 0 ? 'n/a' : `${((actual-ev)/ev*100).toFixed(1)}%`]; });
      summary = [{label:'Vehicles',value:rows.length},{label:'Without rated efficiency or trip distance',value:rows.filter(r=>r[2]==='n/a').length},{label:'Completed trips without distance',value:result.rows.reduce((n,r)=>n+(r.missing_distance||0),0)}];
      notes.push('Expected consumption is calculated from rated efficiency and recorded trip distance. Actual is fuel/energy purchased in the selected period, not fuel burned; short periods may therefore look different. Vehicles without a rating or recorded trip distance show n/a.');
      if (summary[2].value) notes.push(`${summary[2].value} completed trips have no distance recorded and are excluded from expected-consumption calculations.`); break;
    }
    default: throw Object.assign(new Error('Unknown report.'), { status: 404 });
  }
  return { key, title: REPORTS[key].title, subtitle: REPORTS[key].subtitle, columns, rows, summary, notes, filters: f };
}

async function getReportOptions(req, res, next) {
  try {
    const [drivers, vehicles, types, fuels] = await Promise.all([
      pool.query(`SELECT id,name FROM users WHERE role='Driver' ORDER BY name`),
      pool.query(`SELECT id,plate_number,brand_name,model_name FROM vehicles ORDER BY plate_number`),
      pool.query(`SELECT id,name FROM vehicle_types ORDER BY name`),
      pool.query(`SELECT id,name FROM fuel_types ORDER BY name`),
    ]);
    res.json({ drivers: drivers.rows, vehicles: vehicles.rows, vehicleTypes: types.rows, fuelTypes: fuels.rows });
  } catch (err) { next(err); }
}

async function getReport(req, res, next) {
  const key = req.params.reportKey;
  if (!REPORTS[key]) return res.status(404).json({ error: 'Report not found.' });
  const f = parseFilters(req.query, key);
  if (f.error) return res.status(400).json({ error: f.error });
  try {
    const data = await queryReport(key, f);
    res.json({ report: { ...data, generatedAt: new Date().toISOString(), generatedBy: req.user.name, periodLabel: PERIOD_REPORTS.has(key) ? `${f.start} – ${f.end}` : 'All records' } });
  } catch (err) { next(err); }
}

const zlib = require('node:zlib');
function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function zipFiles(files) {
  const locals = [], centrals = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const nameBuf = Buffer.from(name, 'utf8');
    const raw = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
    const compressed = zlib.deflateRawSync(raw);
    const crc = crc32(raw);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50,0); local.writeUInt16LE(20,4); local.writeUInt16LE(0,6); local.writeUInt16LE(8,8);
    local.writeUInt32LE(crc,14); local.writeUInt32LE(compressed.length,18); local.writeUInt32LE(raw.length,22); local.writeUInt16LE(nameBuf.length,26);
    locals.push(local,nameBuf,compressed);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50,0); central.writeUInt16LE(20,4); central.writeUInt16LE(20,6); central.writeUInt16LE(0,8); central.writeUInt16LE(8,10);
    central.writeUInt32LE(crc,16); central.writeUInt32LE(compressed.length,20); central.writeUInt32LE(raw.length,24); central.writeUInt16LE(nameBuf.length,28); central.writeUInt32LE(offset,42);
    centrals.push(central,nameBuf);
    offset += local.length + nameBuf.length + compressed.length;
  }
  const centralSize = centrals.reduce((n,b)=>n+b.length,0);
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50,0); end.writeUInt16LE(Object.keys(files).length,8); end.writeUInt16LE(Object.keys(files).length,10); end.writeUInt32LE(centralSize,12); end.writeUInt32LE(offset,16);
  return Buffer.concat([...locals,...centrals,end]);
}
function xmlEscape(value) { return escapeHtml(value).replace(/\r/g,'').replace(/\n/g,'&#10;'); }
function buildXlsx(report, generatedStamp) {
  const rows = [[report.title],[`Generated ${generatedStamp} by ${report.generatedBy} · ${report.periodLabel}`],report.summary.map(s=>`${s.label}: ${s.value}`),report.columns,...report.rows];
  const cell = (value, index, rowNumber) => {
    const ref = (() => { let n=index+1, out=''; while(n){const r=(n-1)%26;out=String.fromCharCode(65+r)+out;n=Math.floor((n-1)/26);}return out;})()+rowNumber;
    if (typeof value === 'number' && Number.isFinite(value)) return `<c r="${ref}" t="n"><v>${value}</v></c>`;
    return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(value ?? '')}</t></is></c>`;
  };
  const sheetRows = rows.map((row,ri)=>`<row r="${ri+1}">${row.map((v,ci)=>cell(v,ci,ri+1)).join('')}</row>`).join('');
  const notes = report.notes.map(n=>[n]);
  const extra = notes.map((row,i)=>`<row r="${rows.length+i+1}">${cell(row[0],0,rows.length+i+1)}</row>`).join('');
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}${extra}</sheetData></worksheet>`;
  return zipFiles({
    '[Content_Types].xml':'<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    '_rels/.rels':'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml':'<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Report" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels':'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/worksheets/sheet1.xml':sheet,
  });
}
function buildDocx(report, generatedStamp) {
  const para = (text, bold=false) => `<w:p><w:r>${bold?'<w:rPr><w:b/></w:rPr>':''}<w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r></w:p>`;
  const cell = (text) => `<w:tc><w:tcPr><w:tcW w:w="2200" w:type="dxa"/></w:tcPr>${para(String(text ?? ''))}</w:tc>`;
  const row = (values, header=false) => `<w:tr>${values.map(v=>`<w:tc><w:tcPr><w:tcW w:w="2200" w:type="dxa"/>${header?'<w:shd w:fill="EAE7F2"/>':''}</w:tcPr>${para(String(v ?? ''),header)}</w:tc>`).join('')}</w:tr>`;
  const table = `<w:tbl><w:tblPr><w:tblBorders><w:top w:val="single" w:sz="4" w:color="D8D3E3"/><w:left w:val="single" w:sz="4" w:color="D8D3E3"/><w:bottom w:val="single" w:sz="4" w:color="D8D3E3"/><w:right w:val="single" w:sz="4" w:color="D8D3E3"/><w:insideH w:val="single" w:sz="4" w:color="D8D3E3"/><w:insideV w:val="single" w:sz="4" w:color="D8D3E3"/></w:tblBorders></w:tblPr>${row(report.columns,true)}${report.rows.map(r=>row(r)).join('')}</w:tbl>`;
  const body = `${para(report.title,true)}${para(report.subtitle)}${para(`Generated ${generatedStamp} by ${report.generatedBy} · ${report.periodLabel}`)}${report.summary.map(s=>para(`${s.label}: ${s.value}`)).join('')}${table}${report.notes.map(n=>para(n)).join('')}<w:sectPr><w:pgSz w:w="15840" w:h="12240" w:orient="landscape"/><w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720"/></w:sectPr>`;
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`;
  return zipFiles({
    '[Content_Types].xml':'<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    '_rels/.rels':'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    'word/document.xml':document,
  });
}

async function exportReport(req, res, next) {
  const key = req.params.reportKey;
  if (!REPORTS[key]) return res.status(404).json({ error: 'Report not found.' });
  const f = parseFilters(req.query, key);
  if (f.error) return res.status(400).json({ error: f.error });
  const format = str(req.query.format).toLowerCase();
  if (!['xlsx','docx'].includes(format)) return res.status(400).json({ error: 'Choose xlsx or docx export format. Use Print / Save as PDF in the report page for PDF.' });
  try {
    const data = await queryReport(key, f);
    const report = { ...data, generatedBy: req.user.name, periodLabel: PERIOD_REPORTS.has(key) ? `${f.start} – ${f.end}` : 'All records' };
    const stamp = new Date().toISOString().slice(0,10);
    const generatedStamp = new Date().toLocaleString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
    if (format === 'xlsx') {
      res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition',`attachment; filename="${key}-${stamp}.xlsx"`);
      return res.send(buildXlsx(report, generatedStamp));
    }
    res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition',`attachment; filename="${key}-${stamp}.docx"`);
    return res.send(buildDocx(report, generatedStamp));
  } catch (err) { next(err); }
}

module.exports = { getReportOptions, getReport, exportReport };
