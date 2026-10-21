import { useCallback, useEffect, useState } from 'react';
import { CalendarDays, Fuel, ReceiptText, RefreshCw, Search } from 'lucide-react';
import { listFuelLogs } from '../../api/fuelLogs.api.js';
import { getVehicleName } from '../../utils/vehicleDisplay.js';
import './fuel-logs.css';

const initialData = {
  transactions: [], total: 0, page: 1, pageSize: 8, totalPages: 1,
  stats: { liters_this_month: 0, transactions_this_month: 0, total_transactions: 0 },
  vehicles: [], fuelTypes: []
};
const number = (value) => Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
const dateText = (value) => value ? new Date(`${String(value).slice(0, 10)}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
const timeText = (value) => value ? new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }) : '';

export default function FuelLogsPage() {
  const [filters, setFilters] = useState({ page: 1, pageSize: 8, q: '', vehicleId: 'all', fuelTypeId: 'all', period: '30days' });
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await listFuelLogs(filters));
    } catch (err) {
      setError(err.message || 'Unable to load fuel logs.');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { load(); }, [load]);
  const change = (key, value) => setFilters((current) => ({ ...current, [key]: value, page: 1 }));

  return (
    <main className="fuel-page">
      <header className="fuel-head">
        <div>
          <div className="fuel-eyebrow">FUEL OPERATIONS <span>· {number(data.stats.total_transactions)} TRANSACTIONS RECORDED</span></div>
          <h1>Fuel Logs</h1>
          <p>Review, verify, and audit fuel transactions recorded across the corporate fleet.</p>
        </div>
        <button className="fuel-refresh" onClick={load} disabled={loading}><RefreshCw size={15} className={loading ? 'fuel-spin' : ''} /> Refresh</button>
      </header>

      <section className="fuel-stats">
        <article className="fuel-stat">
          <div className="fuel-stat-label">FUEL THIS MONTH <span><Fuel size={18} /></span></div>
          <div className="fuel-stat-value">{number(data.stats.liters_this_month)} <small>L</small></div>
        </article>
        <article className="fuel-stat">
          <div className="fuel-stat-label">TRANSACTIONS (THIS MONTH) <span><ReceiptText size={18} /></span></div>
          <div className="fuel-stat-value">{number(data.stats.transactions_this_month)} <small className="fuel-recorded">● Recorded</small></div>
        </article>
      </section>

      <section className="fuel-toolbar">
        <label className="fuel-search"><Search size={16} /><input value={filters.q} placeholder="Filter reference or plate..." onChange={(event) => change('q', event.target.value)} /></label>
        <div className="fuel-filter-controls">
          <select aria-label="Filter by vehicle" value={filters.vehicleId} onChange={(event) => change('vehicleId', event.target.value)}>
            <option value="all">All Vehicles</option>
            {data.vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{getVehicleName(vehicle)} · {vehicle.plate_number}</option>)}
          </select>
          <select aria-label="Filter by fuel type" value={filters.fuelTypeId} onChange={(event) => change('fuelTypeId', event.target.value)}>
            <option value="all">All Fuel Types</option>
            {data.fuelTypes.map((fuel) => <option key={fuel.id} value={fuel.id}>{fuel.name}</option>)}
          </select>
          <select aria-label="Filter by date" value={filters.period} onChange={(event) => change('period', event.target.value)}>
            <option value="30days">Past 30 Days</option>
            <option value="7days">Past 7 Days</option>
            <option value="thisMonth">This Month</option>
            <option value="all">All Dates</option>
          </select>
        </div>
      </section>

      {error && <div className="fuel-error">{error}<button onClick={load}>Retry</button></div>}

      <section className="fuel-table-card">
        <div className="fuel-table-wrap">
          <table className="fuel-table">
            <thead><tr><th>DATE &amp; TIME</th><th>REFERENCE</th><th>VEHICLE</th><th>FUEL TYPE</th><th>QUANTITY</th><th>RECORDED BY</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan="6" className="fuel-empty">Loading fuel transactions…</td></tr>
                : data.transactions.length === 0 ? <tr><td colSpan="6" className="fuel-empty">No fuel transactions match these filters.</td></tr>
                  : data.transactions.map((item) => (
                    <tr key={item.id} className={item.status === 'Flagged' ? 'fuel-row-flagged' : ''}>
                      <td><div className="fuel-date">{dateText(item.fueled_date)}</div><small>{timeText(item.recorded_at)}</small></td>
                      <td><span className={`fuel-reference ${item.status === 'Flagged' ? 'is-flagged' : ''}`}>{item.transaction_ref}</span>{item.status !== 'Recorded' && <small className={`fuel-status fuel-status-${item.status.toLowerCase()}`}>{item.status}</small>}</td>
                      <td><div className="fuel-vehicle-name">{getVehicleName(item)}</div><small>{item.plate_number}</small></td>
                      <td>{item.fuel_type || '—'}</td>
                      <td className="fuel-volume">{number(item.quantity ?? item.liters)} {item.quantity_unit || 'L'}</td>
                      <td><div className="fuel-person"><span className="fuel-avatar">{String(item.recorded_by || '?').split(/\s+/).slice(0, 2).map((part) => part[0] || '').join('').toUpperCase()}</span><span>{item.recorded_by || '—'}</span></div></td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
        <footer className="fuel-footer">
          <span>Showing {data.transactions.length} of {number(data.total)} transactions</span>
          <div className="fuel-pagination">
            <button disabled={filters.page <= 1 || loading} onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))}>‹ Previous</button>
            <span>Page {data.page || filters.page} of {data.totalPages || 1}</span>
            <button disabled={filters.page >= (data.totalPages || 1) || loading} onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}>Next ›</button>
          </div>
        </footer>
      </section>
    </main>
  );
}
