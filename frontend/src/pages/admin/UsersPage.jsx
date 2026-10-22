import { useEffect, useRef, useState } from 'react';
import { Plus, Search, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import StatusBadge from '../../components/StatusBadge.jsx';
import Pagination from '../../components/Pagination.jsx';
import StatusChangeDialog from '../../components/StatusChangeDialog.jsx';
import ResetPasswordDialog from '../../components/ResetPasswordDialog.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { ROLES, ROLE_LABELS } from '../../config/roles.js';
import { listUsers, updateUserStatus, resetUserPassword, updateHigherOfficer } from '../../api/users.api.js';
import './users-page.css';

const PAGE_SIZE = 10;
const SEARCH_DELAY_MS = 300;
const COLUMNS = 5;
const NOTICE_MS = 5000;

const initials = (name) =>
  name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

// Why the Change Status button is greyed out for a row (empty string = it's
// available). The server enforces the same rules; this just saves a click.
function statusBlockedReason(row, me) {
  if (me && row.id === me.id) return "You can't change your own status";
  if (row.isLastActiveAdmin) return 'At least one active System Administrator is required';
  return '';
}

// Same idea for Reset Password. Only accounts that sign in have a password.
function resetBlockedReason(row) {
  if (row.role === ROLES.DRIVER || !row.username) return "Drivers don't sign in, so they have no password";
  return '';
}

export default function UsersPage() {
  const navigate = useNavigate();
  const { user: me } = useAuth();

  // What the person picked
  const [role, setRole] = useState('All');
  const [status, setStatus] = useState('All');
  const [search, setSearch] = useState('');   // what is typed right now
  const [query, setQuery] = useState('');     // what is sent (after a short pause)
  const [page, setPage] = useState(1);

  // What came back
  const [result, setResult] = useState(null); // last successful response
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  // Change Status: which row the dialog is open for, and the "done" message
  const [statusTarget, setStatusTarget] = useState(null);
  const [notice, setNotice] = useState('');

  // Reset Password: which row the dialog is open for
  const [resetTarget, setResetTarget] = useState(null);
  const [privilegeBusyId, setPrivilegeBusyId] = useState(null);

  // Wait until typing pauses before asking the server, so a request isn't
  // sent for every keystroke.
  const sentQuery = useRef('');
  useEffect(() => {
    const timer = setTimeout(() => {
      const next = search.trim();
      if (next !== sentQuery.current) {
        sentQuery.current = next;
        setQuery(next);
        setPage(1);
      }
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [search]);

  // Load the list whenever a filter, the page or the retry counter changes.
  // `ignore` drops the answer of a request that has been replaced by a newer
  // one, so a slow earlier response can't overwrite a faster later one.
  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setError('');

    listUsers({
      role: role === 'All' ? '' : role,
      status: status === 'All' ? '' : status,
      q: query,
      page,
      pageSize: PAGE_SIZE,
    })
      .then((data) => {
        if (ignore) return;
        setResult(data);
        // The server pulls an out-of-range page back (e.g. the last user on
        // the final page was removed); follow it.
        if (data.page !== page) setPage(data.page);
      })
      .catch((err) => {
        if (ignore) return;
        setResult(null);
        setError(err.status === 403
          ? 'You are not authorized to view users.'
          : 'Could not load users. Please try again.');
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => { ignore = true; };
  }, [role, status, query, page, reloadKey]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(''), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  // Called by the dialog. If this throws, the dialog shows the message and
  // stays open; if it succeeds, the dialog closes and the list is reloaded
  // (a status filter may now include or exclude this person).
  async function changeStatus(target, nextStatus) {
    await updateUserStatus(target.id, nextStatus);
    setStatusTarget(null);
    setNotice(`${target.name} is now ${nextStatus}.`);
    setReloadKey((k) => k + 1);
  }

  // Called by the dialog when it closes. `didReset` is true once the new
  // password has been saved (the dialog stays open until then so the
  // administrator can copy it).
  function closeReset(didReset) {
    if (didReset && resetTarget) setNotice(`Password reset for ${resetTarget.name}.`);
    setResetTarget(null);
  }

  const chooseRole = (r) => { setRole(r); setPage(1); };

  async function toggleHigherOfficer(target) {
    const next = !target.isHigherOfficer;
    setPrivilegeBusyId(target.id);
    try {
      await updateHigherOfficer(target.id, next);
      setNotice(`${target.name} ${next ? 'was promoted to' : 'no longer has'} Higher Officer access.`);
      setReloadKey((k) => k + 1);
    } catch (err) {
      setNotice(err.status === 409 ? (err.message || 'Only Officer accounts can have Higher Officer access.') : 'Could not update Higher Officer access.');
    } finally { setPrivilegeBusyId(null); }
  }
  const chooseStatus = (s) => { setStatus(s); setPage(1); };

  const filtersActive = role !== 'All' || status !== 'All' || query !== '';
  const users = result?.users ?? [];

  let body;
  if (error) {
    body = (
      <tr className="up-state-row">
        <td colSpan={COLUMNS} className="up-state">
          <p className="up-error" role="alert">{error}</p>
          <button className="btn btn--soft" onClick={() => setReloadKey((k) => k + 1)}>Try again</button>
        </td>
      </tr>
    );
  } else if (!result) {
    body = (
      <tr className="up-state-row">
        <td colSpan={COLUMNS} className="up-state" role="status">Loading users…</td>
      </tr>
    );
  } else if (users.length === 0) {
    body = (
      <tr className="up-state-row">
        <td colSpan={COLUMNS} className="up-state">
          {filtersActive ? 'No users match these filters.' : 'No users yet.'}
        </td>
      </tr>
    );
  } else {
    body = users.map((u) => (
      <tr key={u.id}>
        <td><div className="person"><span className="avatar">{initials(u.name)}</span><span className="strong">{u.name}</span></div></td>
        <td className="muted">{u.username ?? '—'}</td>
        <td><span className="chip chip--plain">{ROLE_LABELS[u.role] ?? u.role}</span>{u.role === ROLES.MANAGER && u.isHigherOfficer && <span className="up-higher-badge"><ShieldCheck size={12} /> Higher Officer</span>}</td>
        <td><StatusBadge tone={u.status === 'Active' ? 'green' : 'gray'}>{u.status}</StatusBadge></td>
        <td className="ta-right">
          <div className="row-actions">
            <span title={statusBlockedReason(u, me)}>
              <button className="link-btn" disabled={Boolean(statusBlockedReason(u, me))}
                onClick={() => setStatusTarget(u)}>Change Status</button>
            {u.role === ROLES.MANAGER && <button className="link-btn" disabled={privilegeBusyId === u.id || u.status !== 'Active'}
              title={u.status !== 'Active' ? 'Activate the account before changing this privilege' : ''}
              onClick={() => toggleHigherOfficer(u)}>{privilegeBusyId === u.id ? 'Saving…' : (u.isHigherOfficer ? 'Remove Higher Officer' : 'Make Higher Officer')}</button>}
            </span>
            <span title={resetBlockedReason(u)}>
              <button className="link-btn" disabled={Boolean(resetBlockedReason(u))}
                onClick={() => setResetTarget(u)}>Reset Password</button>
            </span>
          </div>
        </td>
      </tr>
    ));
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">ADMINISTRATION</div>
          <h1>Users</h1>
          <p className="muted lead">Manage logins, roles and account status</p>
        </div>
        <div className="page-head__actions">
          <button className="btn btn--primary" onClick={() => navigate('/admin/users/new')}><Plus size={16} /> New User</button>
        </div>
      </div>

      <div className="toolbar">
        <div className="segmented">
          {['All', ...Object.values(ROLES)].map((t) => (
            <button key={t} aria-pressed={role === t}
              className={role === t ? 'is-active' : ''}
              onClick={() => chooseRole(t)}>{ROLE_LABELS[t] ?? t}</button>
          ))}
        </div>
        <select className="select" aria-label="Filter by status" value={status}
          onChange={(e) => chooseStatus(e.target.value)}>
          <option value="All">All Statuses</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>
        <div className="search search--filter">
          <Search size={15} />
          <input placeholder="Filter by name or username..." aria-label="Filter by name or username"
            value={search} onChange={(e) => setSearch(e.target.value)} />
          <kbd>⌘F</kbd>
        </div>
      </div>

      {notice && <p className="up-notice" role="status">{notice}</p>}

      <div className={'table-card' + (loading && result ? ' is-loading' : '')}>
        <table className="table">
          <thead>
            <tr><th>NAME</th><th>USERNAME</th><th>ROLE</th><th>STATUS</th><th className="ta-right">ACTIONS</th></tr>
          </thead>
          <tbody>{body}</tbody>
        </table>
        {result && (
          <Pagination shown={users.length} total={result.total} noun="users"
            page={result.page} pages={result.totalPages} onPageChange={setPage} />
        )}
      </div>

      {statusTarget && (
        <StatusChangeDialog user={statusTarget} onConfirm={changeStatus}
          onCancel={() => setStatusTarget(null)} />
      )}

      {resetTarget && (
        <ResetPasswordDialog user={resetTarget} isSelf={Boolean(me && resetTarget.id === me.id)}
          onSubmit={(target, password) => resetUserPassword(target.id, password)}
          onClose={closeReset} />
      )}
    </>
  );
}
