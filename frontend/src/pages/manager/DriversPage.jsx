import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle2, RefreshCw, Search, Truck } from 'lucide-react';
import { listDrivers } from '../../api/drivers.api.js';
import './drivers.css';

const FILTERS = ['All', 'Available', 'On Trip'];

function DriverStatus({ status }) {
  const onTrip = status === 'On Trip';
  return <span className={`driver-status ${onTrip ? 'driver-status--trip' : 'driver-status--available'}`}><i />{status}</span>;
}

export default function DriversPage() {
  const navigate = useNavigate();
  const [drivers, setDrivers] = useState([]);
  const [summary, setSummary] = useState({ total: 0, available: 0, onTrip: 0 });
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadDrivers = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    try {
      const result = await listDrivers();
      setDrivers(Array.isArray(result.drivers) ? result.drivers : []);
      setSummary(result.summary || { total: 0, available: 0, onTrip: 0 });
      setError('');
    } catch (err) {
      setError(err.message || 'Could not load the driver registry.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDrivers();
    const timer = window.setInterval(() => loadDrivers(true), 30000);
    return () => window.clearInterval(timer);
  }, [loadDrivers]);

  const visibleDrivers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return drivers.filter((driver) => {
      const matchesFilter = filter === 'All' || driver.operational_status === filter;
      const matchesSearch = !query || (driver.name || '').toLowerCase().includes(query);
      return matchesFilter && matchesSearch;
    });
  }, [drivers, filter, search]);

  return (
    <section className="drivers-page">
      <div className="drivers-heading">
        <div>
          <div className="drivers-eyebrow">FLEET REGISTRY <span>•</span> {summary.total} Drivers</div>
          <h1>Drivers</h1>
        </div>
      </div>

      <div className="drivers-summary">
        <article className="drivers-summary-card">
          <div><div className="drivers-summary-label">AVAILABLE DRIVERS</div><div className="drivers-summary-number">{loading && drivers.length === 0 ? '—' : summary.available}<span>of {summary.total} total</span></div></div>
          <div className="drivers-summary-icon drivers-summary-icon--green"><CheckCircle2 size={28} /></div>
        </article>
        <article className="drivers-summary-card">
          <div><div className="drivers-summary-label">ON ACTIVE TRIP</div><div className="drivers-summary-number">{loading && drivers.length === 0 ? '—' : summary.onTrip}<span>of {summary.total} total</span></div></div>
          <div className="drivers-summary-icon drivers-summary-icon--orange"><Truck size={27} /></div>
        </article>
      </div>

      <div className="drivers-toolbar">
        <div className="drivers-tabs" role="tablist" aria-label="Filter drivers">
          {FILTERS.map((item) => {
            const count = item === 'All' ? summary.total : item === 'Available' ? summary.available : summary.onTrip;
            return <button key={item} type="button" role="tab" aria-selected={filter === item} className={filter === item ? 'is-active' : ''} onClick={() => setFilter(item)}>{item} <span>({count})</span></button>;
          })}
        </div>
        <label className="drivers-search"><Search size={17} aria-hidden="true" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Filter by driver name..." aria-label="Filter by driver name" /><kbd>⌘F</kbd></label>
      </div>

      {error && <div className="drivers-error" role="alert"><AlertCircle size={18} /><span>{error}</span><button type="button" onClick={() => loadDrivers()}><RefreshCw size={14} /> Retry</button></div>}

      <div className="drivers-table-card">
        <table className="drivers-table">
          <thead><tr><th>NAME</th><th>PHONE</th><th>STATUS</th><th>CURRENT TRIP DESTINATION</th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan="4"><div className="drivers-state"><RefreshCw className="drivers-spin" size={18} /> Loading driver registry…</div></td></tr>
              : !error && visibleDrivers.length === 0 ? <tr><td colSpan="4"><div className="drivers-state"><Truck size={20} /><strong>No drivers found</strong><span>{search ? 'Try another driver name.' : 'There are no drivers matching this filter.'}</span></div></td></tr>
                : visibleDrivers.map((driver) => (
                  <tr key={driver.id} className="drivers-table-row" onClick={() => navigate(`/manager/drivers/${driver.id}`)} tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); navigate(`/manager/drivers/${driver.id}`); } }} aria-label={`View details for ${driver.name}`}>
                    <td><Link className="drivers-name-link" to={`/manager/drivers/${driver.id}`} onClick={(event) => event.stopPropagation()}>{driver.name}</Link></td>
                    <td className="drivers-phone">{driver.phone || '—'}</td>
                    <td><DriverStatus status={driver.operational_status} /></td>
                    <td>{driver.current_trip_destination && driver.operational_status === 'On Trip' ? <Link className="drivers-destination-link" to={`/manager/drivers/${driver.id}`} onClick={(event) => event.stopPropagation()}>{driver.current_trip_destination} ↗</Link> : <span className="drivers-dash">—</span>}</td>
                  </tr>
                ))}
          </tbody>
        </table>
        <div className="drivers-table-footer">{loading ? 'Loading drivers…' : `Showing ${visibleDrivers.length} of ${summary.total} authorized drivers`}{refreshing && <span className="drivers-refreshing"> · Refreshing…</span>}</div>
      </div>
    </section>
  );
}
