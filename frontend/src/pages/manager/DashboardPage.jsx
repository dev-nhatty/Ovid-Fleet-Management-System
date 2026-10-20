import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, AlertCircle, ArrowRight, CalendarDays, CheckSquare, ChevronRight, ClipboardList, Fuel, GitFork, History, Inbox, MapPin, PlusCircle, RefreshCw, Route, Truck, Users } from 'lucide-react';
import { getDashboardSummary } from '../../api/dashboard.api.js';
import { getVehicleName } from '../../utils/vehicleDisplay.js';
import './dashboard.css';

const moneyless = value => new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(Number(value || 0));
const dateLabel = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' }).format(new Date());
const statusClass = status => ({ Completed: 'done', Cancelled: 'cancelled', 'In Progress': 'in-progress', Assigned: 'assigned' }[status] || 'assigned');
const tripTypeLabel = trip => Number(trip.checkpoint_count) > 0 ? `${trip.checkpoint_count} Checkpoints` : (trip.trip_type || '—');

export default function DashboardPage() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setSummary(await getDashboardSummary()); }
    catch (e) { setError(e.message || 'Unable to load dashboard data.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const data = summary || {};

  return <div className="dashboard-page">
    <header className="dashboard-header">
      <div><h1>Dashboard</h1><p>Here’s what’s happening across your fleet today.</p></div>
      <div className="dashboard-date"><CalendarDays size={15}/>{dateLabel}</div>
    </header>

    {error && <div className="dashboard-error" role="alert"><AlertCircle size={17}/><span>{error}</span><button className="btn btn--soft btn--sm" onClick={load}>Retry</button></div>}

    <section className="dashboard-kpis" aria-label="Fleet summary">
      <article className="dashboard-kpi"><div className="dashboard-kpi__top"><span>Pending requests</span><Inbox size={17}/></div><strong>{loading ? '—' : moneyless(data.pendingRequests)}</strong><p>Awaiting action</p><span className="dashboard-kpi__hint dashboard-kpi__hint--neutral">{loading ? 'Loading' : Number(data.pendingRequests) ? 'Action needed' : 'All caught up'}</span></article>
      <article className="dashboard-kpi"><div className="dashboard-kpi__top"><span>Active trips</span><Route size={17}/></div><strong>{loading ? '—' : moneyless(data.activeTrips)}</strong><p>Currently underway or assigned</p><span className="dashboard-kpi__hint dashboard-kpi__hint--blue">Live trip records</span></article>
      <article className="dashboard-kpi"><div className="dashboard-kpi__top"><span>Available vehicles</span><Truck size={17}/></div><strong>{loading ? '—' : moneyless(data.availableVehicles)}</strong><p>Ready for assignment</p><span className="dashboard-kpi__hint dashboard-kpi__hint--green">Available</span></article>
      <article className="dashboard-kpi"><div className="dashboard-kpi__top"><span>Fuel this month</span><Fuel size={17}/></div><strong>{loading ? '—' : `${moneyless(data.fuelThisMonth)} L`}</strong><p>Fuel recorded this month</p><span className="dashboard-kpi__hint">{loading ? 'Loading' : `${moneyless(data.fuelTransactionsThisMonth)} transactions`}</span></article>
    </section>

    <section className="dashboard-main-grid">
      <article className="dashboard-panel attention-panel">
        <div className="dashboard-panel__heading"><div><h2>Needs your attention</h2><p>Items that may require action</p></div><span className={`dashboard-attention-dot ${Number(data.pendingRequests) > 0 ? 'is-active' : ''}`} /></div>
        <Link to="/manager/queue" className="dashboard-attention-row"><span className="dashboard-row-icon"><ClipboardList size={18}/></span><span className="dashboard-row-copy"><strong>Pending dispatch requests</strong><small>Requests waiting for review or assignment.</small></span><span className="dashboard-count">{loading ? '—' : `${data.pendingRequests} pending`}</span><ChevronRight size={16}/></Link>
        <Link to="/manager/trips" className="dashboard-attention-row"><span className="dashboard-row-icon"><CheckSquare size={18}/></span><span className="dashboard-row-copy"><strong>Trips requiring updates</strong><small>Assigned trips that may need a status update.</small></span><span className="dashboard-count">{loading ? '—' : `${data.activeTrips} active`}</span><ChevronRight size={16}/></Link>
      </article>

      <div className="dashboard-side-stack">
        <article className="dashboard-panel quick-panel"><div className="dashboard-panel__heading"><h2>Quick actions</h2><span className="dashboard-section-note">Shortcuts</span></div><div className="dashboard-quick-grid">
          <Link className="dashboard-quick-action dashboard-quick-action--primary" to="/manager/new-request"><PlusCircle size={16}/>New Request</Link>
          <Link className="dashboard-quick-action" to="/manager/assign-trip"><GitFork size={16}/>Assign Trip<ArrowRight size={14}/></Link>
          <Link className="dashboard-quick-action" to="/manager/record-fuel"><Fuel size={16}/>Record Fuel<ArrowRight size={14}/></Link>
          <Link className="dashboard-quick-action" to="/manager/fuel-logs"><History size={16}/>Fuel Logs<ArrowRight size={14}/></Link>
        </div></article>
        <article className="dashboard-panel fleet-panel"><div className="dashboard-panel__heading"><h2>Fleet status</h2><span className="dashboard-section-note">Current availability</span></div><div className="dashboard-fleet-grid"><div className="dashboard-fleet-stat"><span>Vehicles</span><strong>{loading ? '—' : moneyless(data.availableVehicles)}</strong><b>Available vehicles</b><small>Ready for assignment</small></div><div className="dashboard-fleet-stat"><span>Drivers</span><strong>{loading ? '—' : moneyless(data.availableDrivers)}</strong><b>Available drivers</b><small>Ready for operations</small></div></div></article>
      </div>
    </section>

    <section className="dashboard-panel dashboard-trips-panel">
      <div className="dashboard-trips-heading"><div><h2>Recent Trips</h2><p>A quick overview of the latest fleet trips.</p></div><Link to="/manager/trips" className="dashboard-view-all">View all trips <ArrowRight size={15}/></Link></div>
      <div className="dashboard-trips-wrap"><table className="dashboard-trips-table"><thead><tr><th>Trip ID</th><th>Employee</th><th>Destination</th><th>Trip type</th><th>Vehicle</th><th>Driver</th><th>Status</th></tr></thead><tbody>
        {loading ? <tr><td colSpan="7" className="dashboard-table-empty">Loading recent trips…</td></tr> : !data.trips?.length ? <tr><td colSpan="7" className="dashboard-table-empty">No trip records yet.</td></tr> : data.trips.map(trip => <tr key={trip.trip_id}><td><Link className="dashboard-trip-id" to={`/manager/trips/${trip.trip_id}`}>TRP-{String(trip.trip_id).padStart(4, '0')}</Link></td><td><div className="dashboard-cell-stack"><strong>{trip.employee_name || '—'}</strong><small>{trip.department || 'No department'}</small></div></td><td><span className="dashboard-destination"><MapPin size={14}/>{trip.destination || '—'}</span></td><td><span className="dashboard-type-chip">{tripTypeLabel(trip)}</span></td><td><div className="dashboard-cell-stack"><strong>{getVehicleName(trip)}</strong><small>{trip.plate_number || '—'}</small></div></td><td>{trip.driver_name || '—'}</td><td><span className={`dashboard-status dashboard-status--${statusClass(trip.status)}`}><i/>{trip.status}</span></td></tr>)}
      </tbody></table></div>
      <footer className="dashboard-trips-footer"><span>{loading ? 'Loading trips' : `Showing ${data.trips?.length || 0} recent ${(data.trips?.length || 0) === 1 ? 'trip' : 'trips'}`}</span><Link to="/manager/trips" className="dashboard-view-all">View all trips <ArrowRight size={14}/></Link></footer>
    </section>
    <div className="dashboard-refresh-row"><span><Activity size={13}/> Dashboard data is synced from the fleet database</span><button className="dashboard-refresh" onClick={load} disabled={loading}><RefreshCw size={14} className={loading ? 'is-spinning' : ''}/> Refresh</button></div>
  </div>;
}
