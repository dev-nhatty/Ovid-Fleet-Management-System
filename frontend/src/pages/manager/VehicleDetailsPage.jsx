import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Clock3, RefreshCw, Truck, Fuel, Wrench } from 'lucide-react';
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

function formatDateTime(value) {
  if (!value) return 'Time unavailable';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Time unavailable';
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatCost(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '—';
  return `ETB ${amount.toLocaleString([], { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function MaintenanceStatus({ status }) {
  const normalized = status || 'Unknown';
  const tone = normalized === 'Completed' ? 'completed'
    : normalized === 'In Progress' ? 'progress'
      : normalized === 'Scheduled' ? 'scheduled'
        : normalized === 'Cancelled' ? 'cancelled'
          : 'neutral';
  return <span className={`vehicle-detail-maintenance-status vehicle-detail-maintenance-status--${tone}`}>{normalized}</span>;
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
  const [recentFuelLogs, setRecentFuelLogs] = useState([]);
  const [recentMaintenance, setRecentMaintenance] = useState([]);
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
      setRecentFuelLogs(Array.isArray(result.recentFuelLogs) ? result.recentFuelLogs : []);
      setRecentMaintenance(Array.isArray(result.recentMaintenance) ? result.recentMaintenance : []);
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
            <h1>{[vehicle.brand_name, vehicle.model_name, vehicle.model_year].filter(Boolean).join(' ') || vehicle.vehicle_type || vehicle.plate_number}</h1>
            <span className={`vehicle-detail-operational ${vehicle.operational_status === 'Available' ? 'is-available' : vehicle.operational_status === 'In Use' ? 'is-in-use' : 'is-unavailable'}`}>
              <i /> {vehicle.operational_status}
            </span>
          </div>
          <p>{vehicle.plate_number} <span>•</span> {vehicle.vehicle_type || 'Vehicle type not set'} <span>•</span> {vehicle.fuel_type || 'Fuel type not set'}</p>
          {/electric|\bev\b|battery/i.test(String(vehicle.fuel_type || '')) ? (
            <div className="vehicle-detail-efficiency" aria-label="Electric energy consumption">
              <Fuel size={15} aria-hidden="true" />
              <span>Energy consumption</span>
              <strong>{vehicle.energy_consumption_kwh_per_100km != null && Number(vehicle.energy_consumption_kwh_per_100km) > 0
                ? `${Number(vehicle.energy_consumption_kwh_per_100km).toLocaleString([], { maximumFractionDigits: 2 })} kWh/100 km`
                : 'Not set'}</strong>
            </div>
          ) : (
            <div className="vehicle-detail-efficiency" aria-label="Vehicle fuel efficiency">
              <Fuel size={15} aria-hidden="true" />
              <span>Fuel efficiency</span>
              <strong>{vehicle.fuel_efficiency_km_per_l != null && Number(vehicle.fuel_efficiency_km_per_l) > 0
                ? `${Number(vehicle.fuel_efficiency_km_per_l).toLocaleString([], { maximumFractionDigits: 2 })} km/L`
                : 'Not set'}</strong>
            </div>
          )}
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

      <section className="vehicle-detail-fuel">
        <div className="vehicle-detail-section-heading">
          <h2>Fuel &amp; Charging Log</h2>
          <span>{recentFuelLogs.length} {recentFuelLogs.length === 1 ? 'record' : 'records'}</span>
        </div>
        {recentFuelLogs.length ? (
          <div className="vehicle-detail-fuel-table-wrap">
            <table className="vehicle-detail-fuel-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Fuel type</th>
                  <th>Quantity</th>
                  <th>Reference</th>
                  <th>Status</th>
                  <th>Recorded by</th>
                </tr>
              </thead>
              <tbody>
                {recentFuelLogs.map((log) => (
                  <tr key={log.fuel_transaction_id}>
                    <td>{formatDate(log.fueled_date)}</td>
                    <td>{log.fuel_type || '—'}</td>
                    <td>{Number(log.quantity ?? log.liters ?? 0).toLocaleString([], { maximumFractionDigits: 2 })} {log.quantity_unit || 'L'}</td>
                    <td>{log.transaction_ref || '—'}</td>
                    <td><span className={`vehicle-detail-fuel-status vehicle-detail-fuel-status--${String(log.fuel_status || 'recorded').toLowerCase()}`}>{log.fuel_status || 'Unknown'}</span></td>
                    <td>{log.recorded_by || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="vehicle-detail-empty vehicle-detail-fuel-empty"><Fuel size={22} /><strong>No fuel records yet</strong><span>Fuel transactions recorded for this vehicle will appear here.</span></div>
        )}
      </section>

      <section className="vehicle-detail-maintenance">
        <div className="vehicle-detail-section-heading">
          <h2>Maintenance History</h2>
          <span>{recentMaintenance.length} {recentMaintenance.length === 1 ? 'record' : 'records'}</span>
        </div>
        {recentMaintenance.length ? (
          <div className="vehicle-detail-fuel-table-wrap">
            <table className="vehicle-detail-maintenance-table">
              <thead>
                <tr>
                  <th>Maintenance type</th>
                  <th>Cost</th>
                  <th>Status</th>
                  <th>Time</th>
                  <th>Recorded by</th>
                </tr>
              </thead>
              <tbody>
                {recentMaintenance.map((record) => (
                  <tr key={record.maintenance_record_id}>
                    <td>{record.maintenance_type || '—'}</td>
                    <td>{formatCost(record.cost)}</td>
                    <td><MaintenanceStatus status={record.maintenance_status} /></td>
                    <td><time dateTime={record.maintenance_at}>{formatDateTime(record.maintenance_at)}</time></td>
                    <td>{record.recorded_by || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="vehicle-detail-empty vehicle-detail-maintenance-empty">
            <Wrench size={22} />
            <strong>No maintenance history yet</strong>
            <span>Maintenance records for this vehicle will appear here when they are recorded.</span>
          </div>
        )}
      </section>
    </section>
  );
}
