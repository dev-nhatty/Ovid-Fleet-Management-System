const pool = require('../db/pool');
const validId = (v) => Number.isInteger(Number(v)) && Number(v) > 0 && Number(v) <= 2147483647;
async function listTrips(req,res,next){
 const page=Math.max(1,parseInt(req.query.page,10)||1), pageSize=Math.min(50,Math.max(1,parseInt(req.query.pageSize,10)||7));
 const q=String(req.query.q||'').trim().slice(0,100), status=String(req.query.status||'All'), tripType=String(req.query.tripType||'All'), department=String(req.query.department||'All'), period=String(req.query.period||'all');
 const params=[], where=[]; const add=v=>{params.push(v);return `$${params.length}`;};
 if(q){const p=add(`%${q.replace(/[\\%_]/g,'\\$&')}%`);where.push(`(CAST(t.id AS TEXT) ILIKE ${p} OR CAST(tr.id AS TEXT) ILIKE ${p} OR e.name ILIKE ${p} OR tr.destination ILIKE ${p} OR v.plate_number ILIKE ${p} OR v.brand_name ILIKE ${p} OR v.model_name ILIKE ${p} OR CAST(v.model_year AS TEXT) ILIKE ${p} OR dep.name ILIKE ${p} OR dr.name ILIKE ${p})`);}
 if(['Assigned','In Progress','Completed','Cancelled'].includes(status))where.push(`t.status=${add(status)}`);
 if(['One-way','Round Trip','With Checkpoints'].includes(tripType))where.push(`tr.trip_type=${add(tripType)}`);
 if(department!=='All')where.push(`COALESCE(dep.name,'')=${add(department)}`);
 if(period==='today')where.push(`t.assigned_at>=CURRENT_DATE`); else if(period==='7days')where.push(`t.assigned_at>=CURRENT_DATE-INTERVAL '7 days'`);
 const clause=where.length?`WHERE ${where.join(' AND ')}`:'';
 const base=` FROM trips t JOIN trip_requests tr ON tr.id=t.trip_request_id JOIN employees e ON e.id=tr.employee_id LEFT JOIN departments dep ON dep.id=e.department_id JOIN vehicles v ON v.id=t.vehicle_id JOIN users dr ON dr.id=t.driver_id`;
 try {const c=await pool.query(`SELECT COUNT(*)::int total${base} ${clause}`,params);const total=c.rows[0].total,pages=Math.max(1,Math.ceil(total/pageSize)),currentPage=Math.min(page,pages),i=params.length;
 const r=await pool.query(`SELECT t.id trip_id,tr.id request_id,e.name employee_name,dep.name department,tr.destination,tr.trip_type,tr.status request_status,tr.requested_at,v.plate_number,v.brand_name,v.model_name,v.model_year,dr.name driver_name,t.status,t.assigned_at,t.started_at,t.completed_at,t.distance_km,(SELECT COUNT(*)::int FROM trip_checkpoints tc WHERE tc.trip_request_id=tr.id) checkpoint_count ${base} ${clause} ORDER BY t.assigned_at DESC,t.id DESC LIMIT $${i+1} OFFSET $${i+2}`,[...params,pageSize,(currentPage-1)*pageSize]);
 const s=await pool.query(`SELECT COUNT(*)::int total,COUNT(*) FILTER(WHERE status IN('Assigned','In Progress'))::int active,COUNT(*) FILTER(WHERE status='Completed' AND completed_at>=CURRENT_DATE)::int completed_today FROM trips`);
 const d=await pool.query(`SELECT DISTINCT name FROM departments ORDER BY name`);res.json({trips:r.rows,total,page:currentPage,pageSize,totalPages:pages,stats:s.rows[0],departments:d.rows.map(x=>x.name)});
 }catch(e){next(e);}}
async function getTrip(req,res,next){if(!validId(req.params.tripId))return res.status(400).json({error:'Invalid trip ID.'});try{const r=await pool.query(`SELECT t.id trip_id,tr.id request_id,t.status,t.assigned_at,t.started_at,t.completed_at,t.distance_km,tr.employee_id,e.name employee_name,e.phone employee_phone,dep.name department,tr.destination,tr.trip_type,tr.status request_status,tr.requested_at,v.id vehicle_id,v.plate_number,v.brand_name,v.model_name,v.model_year,vt.name vehicle_type,v.status vehicle_status,dr.id driver_id,dr.name driver_name,dr.phone driver_phone,recorder.name recorded_by,COALESCE((SELECT json_agg(json_build_object('id',tc.id,'location',tc.location,'sequenceOrder',tc.sequence_order) ORDER BY tc.sequence_order) FROM trip_checkpoints tc WHERE tc.trip_request_id=tr.id),'[]'::json) checkpoints FROM trips t JOIN trip_requests tr ON tr.id=t.trip_request_id JOIN employees e ON e.id=tr.employee_id LEFT JOIN departments dep ON dep.id=e.department_id JOIN vehicles v ON v.id=t.vehicle_id LEFT JOIN vehicle_types vt ON vt.id=v.vehicle_type_id JOIN users dr ON dr.id=t.driver_id LEFT JOIN users recorder ON recorder.id=t.recorded_by_user_id WHERE t.id=$1`,[Number(req.params.tripId)]);if(!r.rowCount)return res.status(404).json({error:'Trip not found.'});res.json({trip:r.rows[0]});}catch(e){next(e);}}
async function updateTripStatus(req, res, next) {
 const tripId = Number(req.params.tripId);
 const nextStatus = req.body?.status;
 if (!validId(tripId)) return res.status(400).json({ error: 'Invalid trip ID.' });
 if (!['In Progress', 'Completed', 'Cancelled'].includes(nextStatus)) {
  return res.status(400).json({ error: 'Choose a valid trip status.' });
 }
 const client = await pool.connect();
 try {
  await client.query('BEGIN');
  const result = await client.query(
   `SELECT id, trip_request_id, status FROM trips WHERE id = $1 FOR UPDATE`, [tripId]
  );
  if (!result.rowCount) {
   await client.query('ROLLBACK');
   return res.status(404).json({ error: 'Trip not found.' });
  }
  const trip = result.rows[0];
  const allowed = (trip.status === 'Assigned' && ['In Progress', 'Cancelled'].includes(nextStatus)) ||
   (trip.status === 'In Progress' && ['Completed', 'Cancelled'].includes(nextStatus));
  if (!allowed) {
   await client.query('ROLLBACK');
   return res.status(409).json({ error: `A trip cannot move from ${trip.status} to ${nextStatus}.` });
  }
  let reachedCheckpointIds = [];
  if (nextStatus === 'Cancelled') {
   if (checkpointIds !== undefined && (!Array.isArray(checkpointIds) || checkpointIds.some((id) => !Number.isInteger(Number(id)) || Number(id) <= 0))) {
    await client.query('ROLLBACK');
    return res.status(400).json({ error: 'Reached checkpoints must be supplied as a list of valid checkpoint IDs.' });
   }
   reachedCheckpointIds = Array.isArray(checkpointIds) ? [...new Set(checkpointIds.map(Number))] : [];
   if (reachedCheckpointIds.length) {
    const validCheckpoints = await client.query(
     `SELECT id FROM trip_checkpoints WHERE trip_request_id = $1 AND id = ANY($2::int[])`,
     [trip.trip_request_id, reachedCheckpointIds]
    );
    if (validCheckpoints.rowCount !== reachedCheckpointIds.length) {
     await client.query('ROLLBACK');
     return res.status(400).json({ error: 'One or more selected checkpoints do not belong to this trip.' });
    }
   }
  }
  let updated;
  if (nextStatus === 'In Progress') {
   updated = await client.query(
    `UPDATE trips SET status = 'In Progress', started_at = COALESCE(started_at, NOW()) WHERE id = $1 RETURNING id, status, assigned_at, started_at, completed_at`, [tripId]
   );
  } else if (nextStatus === 'Completed') {
   updated = await client.query(
    `UPDATE trips SET status = 'Completed', completed_at = NOW() WHERE id = $1 RETURNING id, status, assigned_at, started_at, completed_at`, [tripId]
   );
  } else {
   updated = await client.query(
    `UPDATE trips SET status = 'Cancelled' WHERE id = $1 RETURNING id, status, assigned_at, started_at, completed_at`, [tripId]
   );
   await client.query(`UPDATE trip_requests SET status = 'Cancelled' WHERE id = $1`, [trip.trip_request_id]);
  }
  await client.query('COMMIT');
  return res.json({ trip: updated.rows[0], message: `Trip marked ${nextStatus.toLowerCase()}.`, ...(nextStatus === 'Cancelled' ? { reachedCheckpointIds } : {}) });
 } catch (err) {
  try { await client.query('ROLLBACK'); } catch {}
  next(err);
 } finally {
  client.release();
 }
}
module.exports={listTrips,getTrip,updateTripStatus};
