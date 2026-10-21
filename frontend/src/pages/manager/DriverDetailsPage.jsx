import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Clock3, Phone, RefreshCw, Route, UserRound } from 'lucide-react';
import { getDriverDetails } from '../../api/drivers.api.js';
import './driver-details.css';

function formatDate(value) {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return `Today, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

function DriverStatus({ status }) {
  const normalized = status || 'Unknown';
  const tone = normalized === 'Available' ? 'available'
    : normalized === 'On Trip' ? 'on-trip'
      : normalized === 'Unavailable' ? 'unavailable' : 'neutral';
  return <span className={`driver-detail-status driver-detail-status--${tone}`}><i />{normalized}</span>;
}

function TripStatus({ status }) {
  const normalized = status || 'Unknown';
  const tone = normalized === 'In Progress' ? 'progress'
    : normalized === 'Completed' ? 'completed'
      : normalized === 'Assigned' ? 'assigned'
        : normalized === 'Cancelled' ? 'cancelled' : 'neutral';
  return <span className={`driver-detail-trip-status driver-detail-trip-status--${tone}`}>{normalized}</span>;
}

export default function DriverDetailsPage() {
  const { driverId } = useParams();
  const [driver, setDriver] = useState(null);
  const [recentTrips, setRecentTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadDetails = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    try {
      const result = await getDriverDetails(driverId);
      setDriver(result.driver || null);
      setRecentTrips(Array.isArray(result.recentTrips) ? result.recentTrips : []);
      setError('');
    } catch (err) {
      setError(err.message || 'Could not load driver details.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [driverId]);

  useEffect(() => {
    loadDetails();
    const timer = window.setInterval(() => loadDetails(true), 30000);
    return () => window.clearInterval(timer);
  }, [loadDetails]);

  if (loading) return <div className="driver-detail-state"><RefreshCw className="driver-detail-spin" size={20} /> Loading driver details…</div>;

  if (error && !driver) {
    return <section className="driver-detail-page"><Link className="driver-detail-back" to="/manager/drivers"><ArrowLeft size={16} /> Back to Drivers</Link><div className="driver-detail-alert" role="alert"><AlertCircle size={18} /><span>{error}</span><button type="button" onClick={() => loadDetails()}>Retry</button></div></section>;
  }

  if (!driver) return <section className="driver-detail-page"><Link className="driver-detail-back" to="/manager/drivers"><ArrowLeft size={16} /> Back to Drivers</Link><div className="driver-detail-state"><UserRound size={24} /><strong>Driver not found</strong><span>This driver may have been removed or the link is invalid.</span></div></section>;

  const onTrip = driver.operational_status === 'On Trip';
  const currentTripActive = onTrip && driver.current_trip_id != null;

  return (
    <section className="driver-detail-page">
      <div className="driver-detail-topline">
        <Link className="driver-detail-back" to="/manager/drivers"><ArrowLeft size={16} /> Back to Drivers</Link>
        <span className="driver-detail-refresh"><Clock3 size={13} /> {refreshing ? 'Refreshing…' : 'Auto-refreshes every 30 seconds'}</span>
      </div>

      {error && <div className="driver-detail-alert" role="alert"><AlertCircle size={17} /><span>{error} Showing the last loaded data.</span><button type="button" onClick={() => loadDetails()}>Retry</button></div>}

      <article className="driver-detail-hero">
        <div className="driver-detail-identity">
          <div className="driver-detail-title-line">
            <h1>{driver.name || 'Unnamed driver'}</h1>
            <DriverStatus status={driver.operational_status} />
          </div>
          <p>Driver <span>•</span> ID #{driver.id}</p>
          <div className="driver-detail-phone-line">
            <Phone size={15} aria-hidden="true" />
            {driver.phone ? <a href={`tel:${driver.phone.replace(/[^+\d]/g, '')}`}>{driver.phone}</a> : <span>No phone number on file</span>}
          </div>
        </div>
        {currentTripActive && (
          <div className="driver-detail-active">
            <div className="driver-detail-section-label">ACTIVE ASSIGNMENT</div>
            <div className="driver-detail-current-trip"><span>Current destination</span><strong>{driver.current_trip_destination || 'Destination not specified'}</strong></div>
            <TripStatus status={driver.current_trip_status} />
          </div>
        )}
      </article>

      <section className="driver-detail-information">
        <div className="driver-detail-section-heading"><h2>Driver Information</h2><span>Profile overview</span></div>
        <div className="driver-detail-info-grid">
          <article className="driver-detail-info-card">
            <span className="driver-detail-info-icon"><UserRound size={17} /></span>
            <div><span className="driver-detail-info-label">Driver name</span><strong>{driver.name || '—'}</strong></div>
          </article>
          <article className="driver-detail-info-card">
            <span className="driver-detail-info-icon"><Phone size={17} /></span>
            <div><span className="driver-detail-info-label">Phone number</span><strong>{driver.phone || 'Not provided'}</strong></div>
          </article>
          <article className="driver-detail-info-card">
            <span className="driver-detail-info-icon"><Route size={17} /></span>
            <div><span className="driver-detail-info-label">Current assignment</span><strong>{currentTripActive ? (driver.current_trip_destination || 'Destination not specified') : 'No active trip'}</strong></div>
          </article>
        </div>
      </section>

      <section className="driver-detail-trips">
        <div className="driver-detail-section-heading">
          <h2>Recent Trips</h2>
          <span>{recentTrips.length} {recentTrips.length === 1 ? 'trip' : 'trips'} · latest 5</span>
        </div>
        {recentTrips.length ? (
          <div className="driver-detail-trip-list">
            {recentTrips.map((trip) => (
              <article className="driver-detail-trip-row" key={trip.trip_id}>
                <div className="driver-detail-trip-main"><strong>{trip.destination || 'Destination not specified'}</strong><span>Trip #{trip.trip_id}</span></div>
                <time dateTime={trip.activity_at || trip.assigned_at}>{formatDate(trip.activity_at || trip.assigned_at)}</time>
                <TripStatus status={trip.trip_status} />
              </article>
            ))}
          </div>
        ) : (
          <div className="driver-detail-empty"><Route size={22} /><strong>No trip history yet</strong><span>Trips assigned to this driver will appear here.</span></div>
        )}
      </section>
    </section>
  );
}
