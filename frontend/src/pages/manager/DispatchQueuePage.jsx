import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Plus, Truck, Search, MapPin, ArrowRight, ArrowLeftRight, GitFork, CheckCircle2, X, Clock } from 'lucide-react';
import StatusBadge from '../../components/StatusBadge.jsx';
import Pagination from '../../components/Pagination.jsx';
import { listTripRequests } from '../../api/tripRequests.api.js';
import './dispatch-queue.css';

const TRIP_ICON = { 'With Checkpoints': GitFork, 'Round Trip': ArrowLeftRight, 'One-way': ArrowRight };
const initials = (name = '') => name.replace('Dr. ', '').split(' ').filter(Boolean).map((p) => p[0]).slice(0, 2).join('');

function Status({ status }) {
  if (status === 'Assigned') return <StatusBadge tone="blue">Assigned</StatusBadge>;
  if (status === 'In Progress') return <StatusBadge tone="blue">In Progress</StatusBadge>;
  if (status === 'Completed') return <StatusBadge tone="green">Completed</StatusBadge>;
  if (status === 'Cancelled') return <StatusBadge tone="red">Cancelled</StatusBadge>;
  if (status === 'Rejected') return <StatusBadge tone="red">Rejected</StatusBadge>;
  if (status === 'Approved') return <StatusBadge tone="green">Approved</StatusBadge>;
  return <StatusBadge tone="gray">Pending</StatusBadge>;
}

export default function DispatchQueuePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [notice, setNotice] = useState('');
  const [highlightedRequestId, setHighlightedRequestId] = useState(null);
  const [requests, setRequests] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState({ pendingRequests: 0, availableVehicles: 0 });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [tripFilter, setTripFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('Pending');
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listTripRequests({ page, pageSize: 10, status: statusFilter })
      .then((result) => {
        if (cancelled) return;
        setRequests(result.requests || []);
        setTotal(result.total || 0);
        setPages(result.totalPages || 1);
        setSummary(result.summary || { pendingRequests: 0, availableVehicles: 0 });
        setLoadError('');
      })
      .catch((err) => { if (!cancelled) setLoadError(err.message || 'Could not load trip requests.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [page, statusFilter, location.key]);

  // Consume the one-time navigation state so refreshes do not replay the toast.
  useEffect(() => {
    const state = location.state;
    if (!state?.assignmentNotice) return;
    setNotice(state.assignmentNotice);
    setHighlightedRequestId(state.assignedRequestId == null ? null : String(state.assignedRequestId));
    navigate(location.pathname, { replace: true, state: null });
  }, [location.key, location.pathname, location.state, navigate]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(''), 3000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!highlightedRequestId) return undefined;
    const timer = window.setTimeout(() => setHighlightedRequestId(null), 3000);
    return () => window.clearTimeout(timer);
  }, [highlightedRequestId]);

  function openQueueRow(request) {
    if (request.trip_id) navigate(`/manager/trips/${request.trip_id}`);
    else navigate(`/manager/assign-trip/${request.id}`);
  }

  const visible = requests.filter((r) => {
    const typeMatch = tripFilter === 'All' || r.trip_type === tripFilter;
    const text = `${r.employee_name || ''} ${r.department || ''} ${r.origin || ''} ${r.destination || ''}`.toLowerCase();
    return typeMatch && text.includes(search.toLowerCase());
  });

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">DISPATCH OPERATIONS <i className="dot dot--gray" /> <a className="blue">{total} Requests</a></div>
          <h1>Dispatch Queue</h1>
          <p className="muted lead">Review pending requests and open recently assigned trips</p>
        </div>
        <div className="page-head__actions">
          <button className="btn btn--primary" onClick={() => navigate('/manager/new-request')}><Plus size={16} /> New Request <kbd className="kbd--dark">C</kbd></button>
        </div>
      </div>

      {notice && (
        <div className="queue-success-toast" role="status" aria-live="polite">
          <CheckCircle2 size={21} aria-hidden="true" />
          <div className="queue-success-toast__copy"><strong>Trip assigned successfully</strong><span>{notice}</span></div>
          <button type="button" className="queue-success-toast__close" onClick={() => setNotice('')} aria-label="Dismiss success message"><X size={17} /></button>
        </div>
      )}

      <div className="stat-row">
        <div className="stat">
          <div className="stat__label">VEHICLES STANDBY <Truck size={16} /></div>
          <div className="stat__value">{loading ? '—' : summary.availableVehicles} <span className="muted small">available vehicles</span></div>
          <div className="progress"><span style={{ width: summary.availableVehicles > 0 ? '100%' : '0%' }} /></div>
          <div className="small muted">Active vehicles not currently assigned to an active trip.</div>
        </div>
        <div className="stat">
          <div className="stat__label">PENDING REQUESTS <Clock size={16} /></div>
          <div className="stat__value">{loading ? '—' : summary.pendingRequests} <span className="muted small">awaiting review</span></div>
          <div className="small muted">Requests that have not yet been assigned.</div>
        </div>
      </div>

      <div className="toolbar queue-toolbar">
        <div className="queue-filters">
          <label className="queue-status-filter">Status
            <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
              <option value="Pending">Pending</option>
              <option value="Assigned">Assigned</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
              <option value="All">All statuses</option>
            </select>
          </label>
          <div className="segmented">
            {['All', 'One-way', 'Round Trip', 'With Checkpoints'].map((type) => (
              <button type="button" key={type} className={tripFilter === type ? 'is-active' : ''} onClick={() => setTripFilter(type)}>{type}</button>
            ))}
          </div>
        </div>
        <div className="search search--filter">
          <Search size={15} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter by employee or destination..." />
        </div>
      </div>

      <div className="table-card">
        <table className="table">
          <thead><tr><th>EMPLOYEE & DEPT</th><th>DESTINATION</th><th>TRIP TYPE</th><th>REQUESTED</th><th>STATUS</th><th /></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan="6">Loading trip requests…</td></tr>
              : loadError ? <tr><td colSpan="6" className="red">{loadError}</td></tr>
                : visible.length === 0 ? <tr><td colSpan="6">{`No ${statusFilter === 'All' ? '' : statusFilter.toLowerCase() + ' '}requests match these filters. Use New Request to create one.`}</td></tr>
                  : visible.map((r) => {
                    const TripIcon = TRIP_ICON[r.trip_type] || ArrowRight;
                    const requested = new Date(r.requested_at);
                    const isNewlyAssigned = highlightedRequestId === String(r.id);
                    return (
                      <tr
                        key={r.id}
                        className={`queue-row-clickable${isNewlyAssigned ? ' queue-row--just-assigned' : ''}`}
                        onClick={() => openQueueRow(r)}
                        onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openQueueRow(r); } }}
                        tabIndex={0}
                        aria-label={r.trip_id ? `Open trip ${r.trip_id} details` : `Open request ${r.id} to assign a trip`}
                      >
                        <td><div className="person">
                          <span className="avatar avatar--lg">{initials(r.employee_name)}</span>
                          <div><div className="strong">{r.employee_name}</div><div className="muted small">{r.department || 'No department'} <i className="dot dot--gray" /> {1 + Number(r.additional_passenger_count || 0)} passenger seats <i className="dot dot--gray" /> #REQ-{String(r.id).padStart(6, '0')}{isNewlyAssigned && <span className="queue-new-label">JUST ASSIGNED</span>}</div></div>
                        </div></td>
                        <td><div className="place"><MapPin size={15} /><div><div className="strong">{r.destination || `${r.checkpoints?.length || 0} destinations`}</div><div className="muted small">From: {r.origin || 'Origin not recorded'} · {r.checkpoints?.length || 0} destinations</div></div></div></td>
                        <td><span className="chip"><TripIcon size={14} /> {r.trip_type}{r.checkpoints?.length > 0 && <em>{r.checkpoints.length} stops</em>}</span></td>
                        <td><div className="strong">{Number.isNaN(requested.getTime()) ? '—' : requested.toLocaleDateString()}</div><div className="muted small">{Number.isNaN(requested.getTime()) ? '' : requested.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div></td>
                        <td><Status status={r.status} /></td>
                        <td className="td-action"><span className="muted small">{r.trip_id ? 'View trip details →' : 'Assign trip →'}</span></td>
                      </tr>
                    );
                  })}
          </tbody>
        </table>
        <Pagination shown={visible.length} total={total} noun="trip requests" page={page} pages={pages} onPageChange={setPage} />
      </div>
    </>
  );
}
