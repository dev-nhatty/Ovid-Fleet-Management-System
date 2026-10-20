import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, AlertCircle, ArrowRight, Building2, RefreshCw, Truck, UserRound, Users } from 'lucide-react';
import { api } from '../../api/client.js';
import './admin-dashboard.css';

const number = (value) => new Intl.NumberFormat().format(Number(value || 0));
const initials = (name = '') => name.trim().split(/\s+/).slice(0, 2).map((part) => part[0] || '').join('').toUpperCase() || '—';

export default function AdminDashboardPage() {
  const [data, setData] = useState({ users: [], userTotal: 0, departments: [], departmentSummary: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // These endpoints are administrator-protected and use the existing session cookie.
      const [userResult, departmentResult] = await Promise.all([
        api('/users?page=1&pageSize=5'),
        api('/departments?page=1&pageSize=5'),
      ]);
      setData({
        users: Array.isArray(userResult?.users) ? userResult.users : [],
        userTotal: Number(userResult?.total || 0),
        departments: Array.isArray(departmentResult?.departments) ? departmentResult.departments : [],
        departmentSummary: departmentResult?.summary || null,
      });
    } catch (err) {
      setError(err?.message || 'Unable to load administrator dashboard data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const activeUsers = data.users.filter((user) => user.status === 'Active');
  const activeDepartments = data.departmentSummary?.active ?? data.departments.filter((department) => department.status === 'Active').length;
  const totalDepartments = data.departmentSummary?.total ?? data.departments.length;
  const unassignedEmployees = data.departmentSummary?.unassignedEmployees;

  return (
    <div className="admin-dashboard">
      <header className="page-head">
        <div>
          <div className="eyebrow">ADMINISTRATION</div>
          <h1>Dashboard</h1>
          <p>Overview of users, departments, and system master data.</p>
        </div>
        <button className="btn btn--primary" type="button" onClick={load} disabled={loading}>
          <RefreshCw size={15} className={loading ? 'is-spinning' : ''} /> Refresh
        </button>
      </header>

      {error && <div className="ad-error" role="alert"><AlertCircle size={17} /><span>{error}</span><button className="btn btn--soft btn--sm" type="button" onClick={load}>Retry</button></div>}

      <section className="ad-metrics" aria-label="Administration summary">
        <article className="ad-metric"><div className="ad-metric__top"><span>Total users</span><span className="ad-metric__icon"><Users size={17} /></span></div><div className="ad-metric__value">{loading ? '—' : number(data.userTotal)}</div><div className="ad-metric__detail">Registered system accounts</div></article>
        <article className="ad-metric"><div className="ad-metric__top"><span>Active accounts</span><span className="ad-metric__icon"><UserRound size={17} /></span></div><div className="ad-metric__value">{loading ? '—' : number(activeUsers.length)}</div><div className="ad-metric__detail">Among the latest loaded accounts</div></article>
        <article className="ad-metric"><div className="ad-metric__top"><span>Departments</span><span className="ad-metric__icon"><Building2 size={17} /></span></div><div className="ad-metric__value">{loading ? '—' : number(totalDepartments)}</div><div className="ad-metric__detail">{loading ? 'Loading status' : `${number(activeDepartments)} active departments`}</div></article>
        <article className="ad-metric"><div className="ad-metric__top"><span>Unassigned employees</span><span className="ad-metric__icon"><Truck size={17} /></span></div><div className="ad-metric__value">{loading ? '—' : unassignedEmployees == null ? '—' : number(unassignedEmployees)}</div><div className="ad-metric__detail">Employees without a department</div></article>
      </section>

      <section className="ad-main-grid">
        <article className="ad-panel">
          <div className="ad-panel__head"><div><h2>Recent users</h2><p>Recently listed system accounts.</p></div><Link className="ad-view-link" to="/admin/users">View all <ArrowRight size={14} /></Link></div>
          {loading ? <div className="ad-state">Loading users…</div> : data.users.length === 0 ? <div className="ad-state">No user accounts found.</div> : <div className="ad-table-wrap"><table className="ad-table"><thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Status</th></tr></thead><tbody>{data.users.map((user) => <tr key={user.id}><td><div className="ad-person"><span className="avatar">{initials(user.name)}</span><strong>{user.name}</strong></div></td><td>{user.username || '—'}</td><td>{user.role || '—'}</td><td><span className={`status-badge ${user.status === 'Active' ? 'status-badge--active' : 'status-badge--inactive'}`}>{user.status || 'Unknown'}</span></td></tr>)}</tbody></table></div>}
        </article>

        <div className="ad-panel ad-actions-panel">
          <div className="ad-panel__head"><div><h2>Quick actions</h2><p>Common administration tasks.</p></div></div>
          <Link className="ad-action" to="/admin/users/new"><span className="ad-action__icon"><UserRound size={17} /></span><span><strong>Create user</strong><small>Add an account and assign its role.</small></span><ArrowRight size={15} /></Link>
          <Link className="ad-action" to="/admin/users"><span className="ad-action__icon"><Users size={17} /></span><span><strong>Manage users</strong><small>Review account status and access.</small></span><ArrowRight size={15} /></Link>
          <Link className="ad-action" to="/admin/departments"><span className="ad-action__icon"><Building2 size={17} /></span><span><strong>Manage departments</strong><small>Maintain organizational master data.</small></span><ArrowRight size={15} /></Link>
        </div>
      </section>

      <p className="ad-footnote"><Activity size={13} style={{ verticalAlign: '-2px', marginRight: 6 }} />Dashboard information is retrieved from the administration APIs.</p>
    </div>
  );
}
