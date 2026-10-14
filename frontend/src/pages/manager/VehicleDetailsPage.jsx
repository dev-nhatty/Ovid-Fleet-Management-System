import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Clock3, RefreshCw, Truck } from 'lucide-react';
import { getVehicleDetails } from '../../api/vehicles.api.js';
import './vehicle-details.css';

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

function StatusPill({ status }) {
  const normalized = status || 'Unknown';
  const tone = normalized === 'In Progress' ? 'progress'
    : normalized === 'Completed' ? 'completed'
      : normalized === 'Assigned' ? 'assigned'
        : 'neutral';
  return <span className={`vehicle-detail-status vehicle-detail-status--${tone}`}>{normalized}</span>;
}

export default function VehicleDetailsPage() {
  const { vehicleId } = useParams();
  const navigate = useNavigate();
  const [vehicle, setVehicle] = useState(null);
  const [recentTrips, setRecentTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadDetails = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    try {
      const result = await getVehicleDetails(vehicleId);
      setVehicle(result.vehicle || null);
      setRecentTrips(Array.isArray(result.recentTrips) ? result.recentTrips : []);
      setError('');
    } catch (err) {
      setError(err.message || 'Could not load vehicle details.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [vehicleId]);

  useEffect(() => {
    loadDetails();
    const timer = window.setInterval(() => loadDetails(true), 30000);
    return () => window.clearInterval(timer);
  }, [loadDetails]);

  if (loading) {
    return <div className="vehicle-detail-state"><RefreshCw className="vehicle-detail-spin" size={20} /> Loading vehicle details…</div>;
  }

  if (error && !vehicle) {
    return (
      <section className="vehicle-detail-page">
        <Link className="vehicle-detail-back" to="/manager/vehicles"><ArrowLeft size={16} /> Back to Vehicles</Link>
        <div className="vehicle-detail-alert" role="alert"><AlertCircle size={18} /><span>{error}</span><button type="button" onClick={() => loadDetails()}>Retry</button></div>
      </section>
    );
  }

  if (!vehicle) {
    return (
      <section className="vehicle-detail-page">
        <Link className="vehicle-detail-back" to="/manager/vehicles"><ArrowLeft size={16} /> Back to Vehicles</Link>
        <div className="vehicle-detail-state"><Truck size={24} /><strong>Vehicle not found</strong><span>This vehicle may have been removed or the link is invalid.</span><button type="button" onClick={() => navigate('/manager/vehicles')}>Return to Vehicles</button></div>
      </section>
    );
  }

  const activeAssignment = vehicle.current_trip_id != null;

  return (
    <section className="vehicle-detail-page">
      <div className="vehicle-detail-topline">
        <Link className="vehicle-detail-back" to="/manager/vehicles"><ArrowLeft size={16} /> Back to Vehicles</Link>
        <span className="vehicle-detail-refresh"><Clock3 size={13} /> {refreshing ? 'Refreshing…' : 'Auto-refreshes every 30 seconds'}</span>
      </div>

      {error && <div className="vehicle-detail-alert" role="alert"><AlertCircle size={17} /><span>{error} Showing the last loaded data.</span><button type="button" onClick={() => loadDetails()}>Retry</button></div>}

      <article className="vehicle-detail-hero">
        <div className="vehicle-detail-identity">
          <div className="vehicle-detail-title-line">
            <h1>{vehicle.plate_number}</h1>
            <span className={`vehicle-detail-operational ${vehicle.operational_status === 'Available' ? 'is-available' : vehicle.operational_status === 'In Use' ? 'is-in-use' : 'is-unavailable'}`}>
              <i /> {vehicle.operational_status}
            </span>
          </div>
          <p>{vehicle.vehicle_type || 'Vehicle type not set'} <span>•</span> {vehicle.fuel_type || 'Fuel type not set'}</p>
        </div>
        {activeAssignment && (
          <div className="vehicle-detail-active">
            <div className="vehicle-detail-section-label">ACTIVE ASSIGNMENT</div>
            <div className="vehicle-detail-current-trip">
              <span>Current Trip:</span>
              <strong>{vehicle.current_trip_destination || 'Destination not specified'}</strong>
            </div>
            {vehicle.current_trip_employee && <div className="vehicle-detail-employee">Requested for {vehicle.current_trip_employee}</div>}
            <StatusPill status={vehicle.current_trip_status} />
          </div>
        )}
      </article>

      <section className="vehicle-detail-trips">
        <div className="vehicle-detail-section-heading">
          <h2>Recent Trips</h2>
          <span>{recentTrips.length} {recentTrips.length === 1 ? 'trip' : 'trips'}</span>
        </div>
        {recentTrips.length ? (
          <div className="vehicle-detail-trip-list">
            {recentTrips.map((trip) => (
              <article className="vehicle-detail-trip-row" key={trip.trip_id}>
                <div className="vehicle-detail-trip-main">
                  <strong>{trip.destination || 'Destination not specified'}</strong>
                  {trip.employee_name && <span>Requested for {trip.employee_name}</span>}
                </div>
                <time dateTime={trip.activity_at || trip.assigned_at}>{formatDate(trip.activity_at || trip.assigned_at)}</time>
                <StatusPill status={trip.trip_status} />
              </article>
            ))}
          </div>
        ) : (
          <div className="vehicle-detail-empty"><Truck size={22} /><strong>No trip history yet</strong><span>Trips assigned to this vehicle will appear here.</span></div>
        )}
      </section>
    </section>
  );
}
