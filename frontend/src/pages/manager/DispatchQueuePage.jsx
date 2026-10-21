import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Plus, Flag, Truck, Search, MapPin, ArrowRight, ArrowLeftRight, GitFork } from 'lucide-react';
import StatusBadge from '../../components/StatusBadge.jsx';
import Pagination from '../../components/Pagination.jsx';
import { listTripRequests } from '../../api/tripRequests.api.js';
import './dispatch-queue.css';

const TRIP_ICON = { 'With Checkpoints': GitFork, 'Round Trip': ArrowLeftRight, 'One-way': ArrowRight };
const initials = (name = '') => name.replace('Dr. ', '').split(' ').filter(Boolean).map((p) => p[0]).slice(0, 2).join('');

function Status({ status }) {
  if (status === 'Assigned') return <StatusBadge tone="blue">Assigned</StatusBadge>;
  if (status === 'Cancelled') return <StatusBadge tone="red">Cancelled</StatusBadge>;
  return <StatusBadge tone="gray">Pending</StatusBadge>;
}

export default function DispatchQueuePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [notice, setNotice] = useState(location.state?.assignmentNotice || '');
  const [requests, setRequests] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [tripFilter, setTripFilter] = useState('All');
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listTripRequests({ page, pageSize: 10 })
      .then((result) => {
        if (cancelled) return;
        setRequests(result.requests || []);
        setTotal(result.total || 0);
        setPages(result.totalPages || 1);
        setLoadError('');
      })
      .catch((err) => { if (!cancelled) setLoadError(err.message || 'Could not load trip requests.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [page, location.key]);

  useEffect(() => {
    if (location.state?.assignmentNotice) {
      setNotice(location.state.assignmentNotice);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.key, location.pathname, location.state, navigate]);

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

      {notice && <div className="queue-assignment-notice" role="status">{notice}<button type="button" className="btn btn--soft btn--sm" onClick={() => setNotice('')} aria-label="Dismiss notification">Dismiss</button></div>}

      <div className="stat-row">
        <div className="stat">
          <div className="stat__label">VEHICLES STANDBY <Truck size={16} /></div>
          <div className="stat__value">— <span className="muted small">availability integration pending</span></div>
          <div className="progress"><span style={{ width: '0%' }} /></div>
        </div>
        <div className="stat">
          <div className="stat__label">PRIORITY FLAGGED <Flag size={16} className="red" /></div>
          <div className="stat__value">0 Trips <span className="red small strong">Needs Attention</span></div>
          <div className="small muted">No priority flag field is configured yet.</div>
        </div>
      </div>

      <div className="toolbar">
        <div className="segmented">
          {['All', 'One-way', 'Round Trip', 'With Checkpoints'].map((type) => (
            <button type="button" key={type} className={tripFilter === type ? 'is-active' : ''} onClick={() => setTripFilter(type)}>{type}</button>
          ))}
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
                : visible.length === 0 ? <tr><td colSpan="6">No matching trip requests. Use New Request to create one.</td></tr>
                  : visible.map((r) => {
                    const TripIcon = TRIP_ICON[r.trip_type] || ArrowRight;
                    const requested = new Date(r.requested_at);
                    return (
                      <tr
                        key={r.id}
                        className="queue-row-clickable"
                        onClick={() => openQueueRow(r)}
                        onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openQueueRow(r); } }}
                        tabIndex={0}
                        aria-label={r.trip_id ? `Open trip ${r.trip_id} details` : `Open request ${r.id} to assign a trip`}
                      >
                        <td><div className="person">
                          <span className="avatar avatar--lg">{initials(r.employee_name)}</span>
                          <div><div className="strong">{r.employee_name}</div><div className="muted small">{r.department || 'No department'} <i className="dot dot--gray" /> #REQ-{String(r.id).padStart(6, '0')}</div></div>
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
