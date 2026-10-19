import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, RefreshCw, MapPin, UserRound, Truck, Route, CalendarClock, CheckCircle2, Play, Ban } from 'lucide-react';
import { getTrip, updateTripStatus } from '../../api/trips.api.js';
import './trips.css';
import { getVehicleName } from '../../utils/vehicleDisplay.js';

const date = (value) => value ? new Date(value).toLocaleString() : 'Not recorded';
const cls = (status) => status === 'Completed' ? 'completed' : status === 'In Progress' ? 'progress' : status === 'Cancelled' ? 'cancelled' : 'assigned';

export default function TripDetailPage() {
  const { tripId } = useParams();
  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [savingStatus, setSavingStatus] = useState(false);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await getTrip(tripId);
      setTrip(data.trip);
    } catch (err) {
      setError(err.message || 'Could not load trip details.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [tripId]);

  async function changeStatus(status) {
    if (status === 'Cancelled' && !window.confirm('Cancel this trip?')) return;
    setSavingStatus(true);
    setActionError('');
    setActionMessage('');
    try {
      await updateTripStatus(tripId, status);
      setActionMessage(`Trip marked ${status.toLowerCase()}.`);
      await load();
    } catch (err) {
      setActionError(err.message || 'Could not update the trip status.');
    } finally {
      setSavingStatus(false);
    }
  }

  if (loading && !trip) return <main className="trip-detail-page"><Link className="back-link" to="/manager/trips"><ArrowLeft size={16} /> Back to trips</Link><p className="trip-detail-message">Loading trip details…</p></main>;
  if (error || !trip) return <main className="trip-detail-page"><Link className="back-link" to="/manager/trips"><ArrowLeft size={16} /> Back to trips</Link><div className="trip-error">{error || 'Trip not found.'}<button onClick={load}>Retry</button></div></main>;

  const canStart = trip.status === 'Assigned';
  const canComplete = trip.status === 'In Progress';
  const canCancel = trip.status === 'Assigned' || trip.status === 'In Progress';

  return (
    <main className="trip-detail-page">
      <Link className="back-link" to="/manager/trips"><ArrowLeft size={16} /> Back to trips</Link>
      <div className="trip-detail-head">
        <div>
          <div className="eyebrow">TRIP OPERATIONS · TRP-{String(trip.trip_id).padStart(4, '0')}</div>
          <h1>Trip Details</h1>
          <p>Review assigned personnel, vehicle, route, and trip activity.</p>
        </div>
        <div className="detail-actions">
          <span className={`trip-status ${cls(trip.status)}`}>{trip.status}</span>
          <button className="trip-refresh" onClick={load} disabled={loading}><RefreshCw size={15} /> Refresh</button>
        </div>
      </div>

      {(canStart || canComplete || canCancel) && <section className="trip-lifecycle" aria-label="Trip actions">
        <div><strong>Trip actions</strong><p>{canStart ? 'Start the trip when the driver begins the journey.' : 'Update the trip when its current stage is complete.'}</p></div>
        <div className="trip-lifecycle-buttons">
          {canStart && <button className="lifecycle-btn lifecycle-start" onClick={() => changeStatus('In Progress')} disabled={savingStatus}><Play size={15} /> Start Trip</button>}
          {canComplete && <button className="lifecycle-btn lifecycle-complete" onClick={() => changeStatus('Completed')} disabled={savingStatus}><CheckCircle2 size={16} /> Complete Trip</button>}
          {canCancel && <button className="lifecycle-btn lifecycle-cancel" onClick={() => changeStatus('Cancelled')} disabled={savingStatus}><Ban size={15} /> Cancel Trip</button>}
        </div>
      </section>}
      {actionError && <div className="trip-action-feedback trip-action-error" role="alert">{actionError}</div>}
      {actionMessage && <div className="trip-action-feedback trip-action-success" role="status">{actionMessage}</div>}

      <section className="detail-grid">
        <article className="detail-card detail-wide">
          <h2><Route size={18} /> Route & trip information</h2>
          <div className="detail-destination"><MapPin size={20} /><div><small>DESTINATION</small><strong>{trip.destination}</strong></div></div>
          <div className="detail-fields">
            <div><small>TRIP TYPE</small><strong>{trip.trip_type}</strong></div>
            <div><small>REQUEST ID</small><strong>REQ-{trip.request_id}</strong></div>
            <div><small>DISTANCE</small><strong>{trip.distance_km != null ? `${trip.distance_km} km` : 'Not recorded'}</strong></div>
            <div><small>REQUEST STATUS</small><strong>{trip.request_status}</strong></div>
          </div>
        </article>

        <article className="detail-card">
          <h2><UserRound size={18} /> Employee</h2>
          <div className="detail-person"><span className="detail-avatar">{trip.employee_name?.split(' ').map((x) => x[0]).slice(0, 2).join('')}</span><div><strong>{trip.employee_name}</strong><small>{trip.department || 'No department'}</small></div></div>
          <div className="detail-fields one-col"><div><small>PHONE</small><strong>{trip.employee_phone || 'Not provided'}</strong></div><div><small>EMPLOYEE ID</small><strong>{trip.employee_id}</strong></div></div>
        </article>

        <article className="detail-card">
          <h2><Truck size={18} /> Assigned vehicle</h2>
          <div className="detail-person"><span className="detail-avatar"><Truck size={20} /></span><div className="vehicle-name-stack"><strong>{getVehicleName(trip)}</strong><small>{trip.plate_number}</small></div></div>
          <div className="detail-fields one-col"><div><small>VEHICLE STATUS</small><strong>{trip.vehicle_status}</strong></div><div><small>VEHICLE ID</small><strong>{trip.vehicle_id}</strong></div></div>
        </article>

        <article className="detail-card">
          <h2><UserRound size={18} /> Assigned driver</h2>
          <div className="detail-person"><span className="detail-avatar">{trip.driver_name?.split(' ').map((x) => x[0]).slice(0, 2).join('')}</span><div><strong>{trip.driver_name}</strong><small>Driver</small></div></div>
          <div className="detail-fields one-col"><div><small>PHONE</small><strong>{trip.driver_phone || 'Not provided'}</strong></div><div><small>DRIVER ID</small><strong>{trip.driver_id}</strong></div></div>
        </article>

        <article className="detail-card">
          <h2><CalendarClock size={18} /> Timeline</h2>
          <div className="timeline"><div><i /><span><b>Trip requested</b><small>{date(trip.requested_at)}</small></span></div><div><i /><span><b>Trip assigned</b><small>{date(trip.assigned_at)}</small></span></div><div><i /><span><b>Trip started</b><small>{date(trip.started_at)}</small></span></div><div><i /><span><b>Trip completed</b><small>{date(trip.completed_at)}</small></span></div></div>
        </article>

        <article className="detail-card detail-wide">
          <h2><MapPin size={18} /> Route checkpoints <span className="count-chip">{trip.checkpoints?.length || 0}</span></h2>
          {trip.checkpoints?.length ? <ol className="checkpoint-list">{trip.checkpoints.map((checkpoint, index) => <li key={checkpoint.id || index}><span>{index + 1}</span><div><strong>{checkpoint.location}</strong><small>Checkpoint {index + 1}</small></div>{index === trip.checkpoints.length - 1 && <CheckCircle2 size={17} />}</li>)}</ol> : <p className="detail-muted">No checkpoints were recorded for this trip.</p>}
          <div className="detail-meta">Recorded by <strong>{trip.recorded_by || 'Unknown'}</strong></div>
        </article>
      </section>
    </main>
  );
}
