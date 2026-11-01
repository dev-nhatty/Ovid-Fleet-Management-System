import { useCallback, useEffect, useMemo, useState } from 'react';
import { Phone, MapPin, Navigation, Clock3, RefreshCw, Play, CheckCircle2, Users, CalendarDays, Route } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { getMyDriverTrips, requestTripFinish, requestTripStart } from '../../api/driver.api.js';
import { getVehicleName } from '../../utils/vehicleDisplay.js';
import './driver.css';

const fmt = (value, options = {}) => value ? new Date(value).toLocaleString([], options) : '—';
const tripCode = (id) => `TRP-${String(id).padStart(4, '0')}`;

export default function DriverTodayPage() {
  const { user } = useAuth();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const data = await getMyDriverTrips();
      setTrips(data.trips || []);
    } catch (err) { setError(err.message || 'Could not load your assignments.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const activeTrip = useMemo(() => trips.find((trip) => ['Assigned', 'In Progress'].includes(trip.status)), [trips]);
  const completedThisMonth = trips.filter((trip) => trip.status === 'Completed' && trip.completed_at && new Date(trip.completed_at).getMonth() === new Date().getMonth() && new Date(trip.completed_at).getFullYear() === new Date().getFullYear()).length;
  const completedTotal = trips.filter((trip) => trip.status === 'Completed').length;

  async function sendRequest(action) {
    if (!activeTrip) return;
    setBusy(true); setNotice(''); setActionError('');
    try {
      const result = action === 'start'
        ? await requestTripStart(activeTrip.trip_id)
        : await requestTripFinish(activeTrip.trip_id);
      setNotice(result.message);
      await load();
    } catch (err) { setActionError(err.message || 'Could not send your request.'); }
    finally { setBusy(false); }
  }

  return (
    <div className="driver-page">
      <div className="driver-page-head">
        <div><span className="driver-eyebrow">TODAY</span><h1>Today <span className={`driver-status-pill ${activeTrip?.status === 'In Progress' ? 'is-progress' : activeTrip ? 'is-assigned' : ''}`}>{activeTrip ? (activeTrip.status === 'In Progress' ? 'On a trip' : 'Assigned') : 'No active assignment'}</span></h1><p>Your current assignment</p></div>
        <button className="driver-refresh" onClick={load} disabled={loading}><RefreshCw size={15} /> Updated {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</button>
      </div>

      {error && <div className="driver-alert driver-alert--error" role="alert">{error} <button onClick={load}>Retry</button></div>}
      {notice && <div className="driver-alert driver-alert--success" role="status">{notice}</div>}
      {actionError && <div className="driver-alert driver-alert--error" role="alert">{actionError}</div>}

      {loading ? <div className="driver-empty">Loading your assignment…</div> : activeTrip ? (
        <section className="driver-assignment">
          <div className="driver-assignment-top"><strong>ACTIVE ASSIGNMENT</strong><code>{tripCode(activeTrip.trip_id)}</code><span className={`driver-status-pill ${activeTrip.status === 'In Progress' ? 'is-progress' : 'is-assigned'}`}>{activeTrip.status}</span><span className="driver-trip-type">{activeTrip.trip_type}</span></div>
          <div className="driver-assignment-body">
            <div className="driver-route-grid">
              <article className="driver-route-card"><span className="driver-route-icon"><span className="origin-dot" /></span><div><small>ORIGIN</small><strong>{activeTrip.origin || 'Origin not provided'}</strong><p>Pick-up location</p></div></article>
              <article className="driver-route-card"><span className="driver-route-icon driver-route-icon--dark"><MapPin size={20} /></span><div><small>DESTINATION</small><strong>{activeTrip.destination || 'Destination not provided'}</strong><p>{activeTrip.checkpoint_count ? `${activeTrip.checkpoint_count} route stops` : activeTrip.trip_type}</p></div></article>
            </div>
            <div className="driver-info-grid">
              <article className="driver-info-card"><small>VEHICLE</small><strong>{getVehicleName(activeTrip)}</strong><div><code>{activeTrip.plate_number}</code></div></article>
              <article className="driver-info-card"><small>PASSENGER</small><strong>{activeTrip.passenger_name || 'Passenger not recorded'}</strong><span>{activeTrip.department || 'Department not recorded'}</span>{activeTrip.passenger_phone && <a href={`tel:${activeTrip.passenger_phone}`}><Phone size={14} /> {activeTrip.passenger_phone}</a>}<span className="driver-additional"><Users size={14} /> +{Number(activeTrip.additional_passenger_count || 0)} additional passengers</span></article>
              <article className="driver-info-card"><small>DISPATCH LOGISTICS</small><div className="driver-meta-row"><span>Assigned by</span><strong>{activeTrip.assigned_by || 'Dispatch officer'}</strong></div><div className="driver-meta-row"><span>Assigned time</span><strong>{fmt(activeTrip.assigned_at, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</strong></div>{activeTrip.started_at && <div className="driver-meta-row"><span>Started time</span><strong>{fmt(activeTrip.started_at, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</strong></div>}</article>
            </div>
            <div className="driver-lifecycle">
              {activeTrip.status === 'Assigned' ? <>
                <div className="driver-lifecycle-copy"><strong><Navigation size={16} /> Ready to begin assignment</strong><p>Notify the dispatch officer when you are ready to begin your trip. The officer must confirm and officially start it.</p><span className="driver-contact"><Phone size={13} /> Contact your dispatch desk if needed</span></div>
                <button className="driver-primary-btn" onClick={() => sendRequest('start')} disabled={busy || !!activeTrip.driver_start_requested_at}><Play size={15} /> {busy ? 'Sending…' : activeTrip.driver_start_requested_at ? 'Start Requested' : 'Start Trip'}</button>
                {activeTrip.driver_start_requested_at && <p className="driver-pending-note">Start request sent at {fmt(activeTrip.driver_start_requested_at)}. Waiting for dispatch confirmation.</p>}
              </> : <>
                <div className="driver-lifecycle-copy"><strong><CheckCircle2 size={16} /> Dispatch confirmation required</strong><p>Notify dispatch when you have reached your destination. Tapping this button sends a request; the officer confirms official completion.</p></div>
                <button className="driver-primary-btn" onClick={() => sendRequest('finish')} disabled={busy || !!activeTrip.driver_finish_requested_at}><CheckCircle2 size={16} /> {busy ? 'Sending…' : activeTrip.driver_finish_requested_at ? 'Finish Requested' : 'Mark as Finished'}</button>
                {activeTrip.driver_finish_requested_at && <p className="driver-pending-note">Finish request sent at {fmt(activeTrip.driver_finish_requested_at)}. Waiting for dispatch confirmation.</p>}
              </>}
            </div>
          </div>
        </section>
      ) : <section className="driver-empty-card"><CalendarDays size={30} /><h2>No active assignment</h2><p>When dispatch assigns a trip to you, it will appear here.</p></section>}

      <div className="driver-stats-grid">
        <article className="driver-stat-card"><small>COMPLETED THIS MONTH</small><CalendarDays size={18} /><strong>{completedThisMonth} <span>trips closed</span></strong></article>
        <article className="driver-stat-card"><small>TOTAL COMPLETED</small><CheckCircle2 size={18} /><strong>{completedTotal} <span>all-time records</span></strong></article>
      </div>
    </div>
  );
}
