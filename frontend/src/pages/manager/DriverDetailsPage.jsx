import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, RefreshCw } from 'lucide-react';
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

function TripStatus({ status }) {
  const tone = status === 'In Progress' || status === 'Assigned' ? 'trip' : status === 'Completed' ? 'completed' : status === 'Cancelled' ? 'cancelled' : status === 'Unavailable' ? 'neutral' : 'assigned';
  const label = status === 'In Progress' || status === 'Assigned' ? 'On Trip' : status || 'Unknown';
  return <span className={`driver-detail-trip-status driver-detail-trip-status--${tone}`}>{label}</span>;
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

  if (!driver) return <section className="driver-detail-page"><Link className="driver-detail-back" to="/manager/drivers"><ArrowLeft size={16} /> Back to Drivers</Link><div className="driver-detail-state">Driver not found.</div></section>;

  const onTrip = driver.operational_status === 'On Trip';

  return (
    <section className="driver-detail-page">
      <div className="driver-detail-topline">
        <Link className="driver-detail-back" to="/manager/drivers"><ArrowLeft size={16} /> Back to Drivers</Link>
        {refreshing && <span className="driver-detail-refresh">Refreshing…</span>}
      </div>

      {error && <div className="driver-detail-alert" role="alert"><AlertCircle size={17} /><span>{error} Showing the last loaded data.</span><button type="button" onClick={() => loadDetails()}>Retry</button></div>}

      <header className="driver-detail-hero">
        <div className="driver-detail-identity">
          <div className="driver-detail-title-line"><h1>{driver.name}</h1><TripStatus status={onTrip ? 'In Progress' : driver.operational_status === 'Unavailable' ? 'Unavailable' : 'Available'} /></div>
          {onTrip && <p className="driver-detail-current-trip">Current Trip: <Link to="/manager/queue">{driver.current_trip_destination || 'Destination unavailable'}</Link></p>}
        </div>
        <a className="driver-detail-phone" href={driver.phone ? `tel:${driver.phone.replace(/[^+\d]/g, '')}` : undefined}>{driver.phone || 'No phone number on file'}</a>
      </header>

      <section className="driver-detail-trips">
        <div className="driver-detail-section-label">RECENT TRIPS</div>
        {recentTrips.length ? <div className="driver-detail-trip-list">
          {recentTrips.map((trip) => <article className="driver-detail-trip-row" key={trip.trip_id}>
            <strong>{trip.destination || 'Destination not specified'}</strong>
            <time dateTime={trip.activity_at || trip.assigned_at}>{formatDate(trip.activity_at || trip.assigned_at)}</time>
            <TripStatus status={trip.trip_status} />
          </article>)}
        </div> : <div className="driver-detail-empty">No trip history yet. Trips assigned to this driver will appear here.</div>}
      </section>
    </section>
  );
}
