import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Clock3, RefreshCw, Search, Truck } from 'lucide-react';
import { listVehicles } from '../../api/vehicles.api.js';
import './vehicles.css';
import { getVehicleName } from '../../utils/vehicleDisplay.js';

const FILTERS = ['All', 'Available', 'In Use'];
const dateTime = (value) => {
  if (!value) return 'Not refreshed yet';
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 5) return 'JUST NOW';
  if (seconds < 60) return `${seconds} SECONDS AGO`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} ${minutes === 1 ? 'MINUTE' : 'MINUTES'} AGO`;
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).toUpperCase();
};

function VehicleStatus({ status }) {
  const available = status === 'Available';
  const inUse = status === 'In Use';
  const tone = available ? 'available' : inUse ? 'in-use' : 'unavailable';
  return <span className={`vehicle-status vehicle-status--${tone}`}><i />{status}</span>;
}

export default function VehiclesPage() {
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState([]);
  const [summary, setSummary] = useState({ total: 0, available: 0, inUse: 0, unavailable: 0 });
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [refreshedAt, setRefreshedAt] = useState(null);
  const [clock, setClock] = useState(Date.now());

  const loadVehicles = useCallback(async ({ quiet = false } = {}) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    try {
      const result = await listVehicles();
      setVehicles(Array.isArray(result.vehicles) ? result.vehicles : []);
      setSummary(result.summary || { total: 0, available: 0, inUse: 0, unavailable: 0 });
      setRefreshedAt(result.refreshedAt || new Date().toISOString());
      setError('');
    } catch (err) {
      setError(err.message || 'Could not load the vehicle registry.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadVehicles();
    const refreshTimer = window.setInterval(() => loadVehicles({ quiet: true }), 30000);
    const clockTimer = window.setInterval(() => setClock(Date.now()), 5000);
    return () => {
      window.clearInterval(refreshTimer);
      window.clearInterval(clockTimer);
    };
  }, [loadVehicles]);

  const visibleVehicles = useMemo(() => {
    const query = search.trim().toLowerCase();
    return vehicles.filter((vehicle) => {
      const matchesFilter = filter === 'All' || vehicle.operational_status === filter;
      const searchable = [vehicle.plate_number, vehicle.brand_name, vehicle.model_name, vehicle.model_year, vehicle.vehicle_type]
        .filter(Boolean).join(' ').toLowerCase();
      const matchesSearch = !query || searchable.includes(query);
      return matchesFilter && matchesSearch;
    });
  }, [vehicles, filter, search]);

  // Keep the elapsed-refresh label updating without causing a fleet request.
  void clock;

  return (
    <section className="vehicles-page">
      <div className="vehicles-heading">
        <div>
          <div className="vehicles-eyebrow">FLEET REGISTRY <span>•</span> {summary.total} UNITS</div>
          <h1>Vehicles</h1>
          <p>Active corporate vehicle registry and real-time operational status.</p>
        </div>
      </div>

      <div className="vehicles-summary">
        <article className="vehicles-summary-card">
          <div className="vehicles-summary-label">AVAILABLE VEHICLES</div>
          <div className="vehicles-summary-number">{loading && !refreshedAt ? '—' : summary.available}<span>of {summary.total} total</span></div>
        </article>
        <article className="vehicles-summary-card">
          <div className="vehicles-summary-label">IN USE</div>
          <div className="vehicles-summary-number vehicles-summary-number--orange">{loading && !refreshedAt ? '—' : summary.inUse}<span>assigned to trips</span></div>
        </article>
      </div>

      <div className="vehicles-toolbar">
        <div className="vehicles-tabs" role="tablist" aria-label="Filter vehicles">
          {FILTERS.map((item) => {
            const count = item === 'All' ? summary.total : item === 'Available' ? summary.available : summary.inUse;
            return (
              <button key={item} type="button" role="tab" aria-selected={filter === item}
                className={filter === item ? 'is-active' : ''} onClick={() => setFilter(item)}>
                {item} <span>({count})</span>
              </button>
            );
          })}
        </div>
        <label className="vehicles-search">
          <Search size={16} aria-hidden="true" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search vehicle name or plate..." aria-label="Search vehicle name or plate" />
          <kbd>⌘F</kbd>
        </label>
      </div>

      {error && (
        <div className="vehicles-error" role="alert">
          <AlertCircle size={18} />
          <span>{error}</span>
          <button type="button" onClick={() => loadVehicles()}><RefreshCw size={14} /> Retry</button>
        </div>
      )}

      <div className="vehicles-table-card">
        <table className="vehicles-table">
          <thead>
            <tr><th>VEHICLE</th><th>VEHICLE TYPE</th><th>FUEL TYPE</th><th>STATUS</th><th>CURRENT TRIP DESTINATION</th></tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="5"><div className="vehicles-state"><RefreshCw className="vehicles-spin" size={18} /> Loading vehicle registry…</div></td></tr>
            ) : !error && visibleVehicles.length === 0 ? (
              <tr><td colSpan="5"><div className="vehicles-state"><Truck size={20} /><strong>No vehicles found</strong><span>{search ? 'Try another vehicle name or plate number.' : 'There are no vehicles matching this filter.'}</span></div></td></tr>
            ) : visibleVehicles.map((vehicle) => (
              <tr key={vehicle.id} className="vehicles-table-row" onClick={() => navigate(`/manager/vehicles/${vehicle.id}`)} tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); navigate(`/manager/vehicles/${vehicle.id}`); } }} aria-label={`View details for vehicle ${vehicle.plate_number}`}>
                <td className="vehicles-plate"><Link className="vehicles-plate-link vehicle-name-stack" to={`/manager/vehicles/${vehicle.id}`} onClick={(event) => event.stopPropagation()}><strong>{getVehicleName(vehicle)}</strong><small>{vehicle.plate_number}</small></Link></td>
                <td>{vehicle.vehicle_type || '—'}</td>
                <td className="vehicles-fuel">{vehicle.fuel_type || '—'}</td>
                <td><VehicleStatus status={vehicle.operational_status} /></td>
                <td>
                  {vehicle.current_trip_destination && vehicle.operational_status === 'In Use'
                    ? <span className="vehicles-destination">{vehicle.current_trip_destination} <span aria-hidden="true">↗</span></span>
                    : <span className="vehicles-no-destination">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="vehicles-footer">
        <span>{loading ? 'Loading registered units…' : `Showing ${visibleVehicles.length} of ${summary.total} registered units`}</span>
        <span className="vehicles-refresh-label"><Clock3 size={12} /> {refreshing ? 'REFRESHING…' : `LAST AUTO-REFRESH: ${dateTime(refreshedAt)}`}</span>
      </div>
      <div className="vehicles-refresh-sr" aria-live="polite">{refreshing ? 'Refreshing vehicle data' : ''}</div>
    </section>
  );
}
