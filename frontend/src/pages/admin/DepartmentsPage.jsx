import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Building2, CheckCircle2, CircleHelp, Ellipsis, Plus, RefreshCw, Search, Users, UserRoundX, X } from 'lucide-react';
import Pagination from '../../components/Pagination.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import { createDepartment, getDepartment, listDepartmentEmployees, listDepartments, updateDepartment, updateDepartmentStatus } from '../../api/departments.api.js';
import './departments-page.css';

const PAGE_SIZE = 10;
const initials = (name = '') => name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '?';
const blankForm = { name: '', code: '', description: '', departmentHeadEmployeeId: '', status: 'Active' };

function DepartmentForm({ initial, employees, onSave, onClose }) {
  const [form, setForm] = useState(() => ({ ...blankForm, ...(initial || {}), departmentHeadEmployeeId: initial?.department_head_employee_id ? String(initial.department_head_employee_id) : '' }));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  function change(key, value) { setForm((current) => ({ ...current, [key]: value })); setErrors((current) => ({ ...current, [key]: '' })); }
  async function submit(event) {
    event.preventDefault();
    const nextErrors = {};
    if (!form.name.trim()) nextErrors.name = 'Department name is required.';
    if (!form.code.trim()) nextErrors.code = 'Department code is required.';
    else if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{1,19}$/.test(form.code.trim())) nextErrors.code = 'Use 2–20 letters, numbers, dashes, or underscores.';
    if (form.description.length > 500) nextErrors.description = 'Maximum 500 characters.';
    if (Object.keys(nextErrors).length) { setErrors(nextErrors); return; }
    setSaving(true); setFormError('');
    try {
      await onSave({ name: form.name.trim(), code: form.code.trim().toUpperCase(), description: form.description.trim(), departmentHeadEmployeeId: form.departmentHeadEmployeeId || null, status: form.status });
    } catch (err) {
      setFormError(err.message || 'Could not save this department.');
      if (err.fields) setErrors(err.fields);
    } finally { setSaving(false); }
  }
  return <div className="dp-overlay" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <section className="dp-modal" role="dialog" aria-modal="true" aria-labelledby="dp-form-title">
      <div className="dp-modal__head"><div><h2 id="dp-form-title">{initial ? 'Edit Department' : 'Create Department'}</h2><p className="muted">{initial ? 'Update the department information below.' : 'Add a department to your organizational structure.'}</p></div><button className="dp-icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button></div>
      {formError && <div className="dp-alert" role="alert">{formError}</div>}
      <form onSubmit={submit} noValidate>
        <div className="dp-form-grid">
          <label className="dp-field"><span>Department name <b>*</b></span><input autoFocus value={form.name} maxLength={100} onChange={(e) => change('name', e.target.value)} placeholder="e.g. Human Resources" />{errors.name && <small>{errors.name}</small>}</label>
          <label className="dp-field"><span>Department code <b>*</b></span><input value={form.code} maxLength={20} onChange={(e) => change('code', e.target.value.toUpperCase())} placeholder="e.g. HR" />{errors.code && <small>{errors.code}</small>}<em>Must be unique across departments.</em></label>
          <label className="dp-field dp-field--full"><span>Description</span><textarea value={form.description} maxLength={500} rows={3} onChange={(e) => change('description', e.target.value)} placeholder="Briefly describe this department's responsibilities." />{errors.description && <small>{errors.description}</small>}<em>{form.description.length}/500 characters</em></label>
          <label className="dp-field dp-field--full"><span>Department head</span><select value={form.departmentHeadEmployeeId} onChange={(e) => change('departmentHeadEmployeeId', e.target.value)}><option value="">Not assigned</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</select>{errors.departmentHeadEmployeeId && <small>{errors.departmentHeadEmployeeId}</small>}<em>Only active employees can be selected.</em></label>
          <label className="dp-field"><span>Status</span><select value={form.status} onChange={(e) => change('status', e.target.value)}><option>Active</option><option>Inactive</option></select></label>
        </div>
        <div className="dp-modal__actions"><button type="button" className="btn btn--soft" onClick={onClose} disabled={saving}>Cancel</button><button type="submit" className="btn btn--primary" disabled={saving}>{saving ? 'Saving…' : initial ? 'Save Changes' : 'Create Department'}</button></div>
      </form>
    </section>
  </div>;
}

function DepartmentDetails({ detail, onClose, onEdit }) {
  if (!detail) return null;
  const d = detail.department;
  return <div className="dp-overlay" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}><section className="dp-modal dp-modal--details" role="dialog" aria-modal="true" aria-labelledby="dp-details-title">
    <div className="dp-modal__head"><div><div className="dp-eyebrow">DEPARTMENT DETAILS</div><h2 id="dp-details-title">{d.name}</h2><p className="muted">{d.code} · {d.description || 'No description provided'}</p></div><button className="dp-icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button></div>
    <div className="dp-detail-summary"><div><span>Status</span><StatusBadge tone={d.status === 'Active' ? 'green' : 'gray'}>{d.status}</StatusBadge></div><div><span>Department head</span><strong>{d.department_head_name || 'Not assigned'}</strong></div><div><span>Employees</span><strong>{d.employee_count}</strong></div></div>
    <div className="dp-detail-title"><h3>Employees in this department</h3><span>{detail.employees.length} records</span></div>
    <div className="dp-employee-list">{detail.employees.length ? detail.employees.map((employee) => <div className="dp-employee-row" key={employee.id}><span className="dp-avatar">{initials(employee.name)}</span><div className="dp-employee-name"><strong>{employee.name}</strong><span>{employee.phone || 'No phone recorded'}</span></div><StatusBadge tone={employee.status === 'Active' ? 'green' : 'gray'}>{employee.status}</StatusBadge></div>) : <div className="dp-empty"><Users size={24}/><p>No employees are assigned to this department.</p></div>}</div>
    <div className="dp-modal__actions"><button className="btn btn--soft" onClick={onClose}>Close</button><button className="btn btn--primary" onClick={() => onEdit(d)}>Edit Department</button></div>
  </section></div>;
}

export default function DepartmentsPage() {
  const [status, setStatus] = useState('All');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [formTarget, setFormTarget] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [detail, setDetail] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [notice, setNotice] = useState('');
  const [menuId, setMenuId] = useState(null);
  const sentQuery = useRef('');

  useEffect(() => { const timer = setTimeout(() => { const next = search.trim(); if (next !== sentQuery.current) { sentQuery.current = next; setQuery(next); setPage(1); } }, 250); return () => clearTimeout(timer); }, [search]);
  const load = useCallback(() => {
    let ignore = false; setLoading(true); setError('');
    Promise.all([listDepartments({ status, q: query, page, pageSize: PAGE_SIZE }), listDepartmentEmployees()])
      .then(([data, employeeData]) => { if (ignore) return; setResult(data); setEmployees(employeeData.employees || []); if (data.page !== page) setPage(data.page); })
      .catch((err) => { if (ignore) return; setError(err.status === 403 ? 'You are not authorized to manage departments.' : err.message || 'Could not load departments.'); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [status, query, page, reload]);
  useEffect(() => load(), [load]);
  useEffect(() => { if (!notice) return undefined; const timer = setTimeout(() => setNotice(''), 4500); return () => clearTimeout(timer); }, [notice]);

  const departments = result?.departments || [];
  const summary = result?.summary || { total: 0, active: 0, inactive: 0, unassignedEmployees: 0 };
  const filteredCounts = useMemo(() => ({ All: summary.total, Active: summary.active, Inactive: summary.inactive }), [summary]);
  async function saveDepartment(data) {
    if (formTarget) await updateDepartment(formTarget.id, data); else await createDepartment(data);
    setShowForm(false); setFormTarget(null); setNotice(formTarget ? 'Department updated successfully.' : 'Department created successfully.'); setReload((v) => v + 1);
  }
  async function openDetails(department) {
    setBusyId(department.id); setMenuId(null);
    try { setDetail(await getDepartment(department.id)); } catch (err) { setNotice(err.message || 'Could not load department details.'); }
    finally { setBusyId(null); }
  }
  async function changeStatus(department) {
    const next = department.status === 'Active' ? 'Inactive' : 'Active';
    const assigned = Number(department.employee_count || 0);
    const message = next === 'Inactive' && assigned > 0
      ? `Deactivate ${department.name}? Its ${assigned} assigned employee(s) will remain linked for history, but this department should not receive new assignments.`
      : `${next === 'Inactive' ? 'Deactivate' : 'Activate'} ${department.name}?`;
    if (!window.confirm(message)) return;
    setBusyId(department.id); setMenuId(null);
    try { await updateDepartmentStatus(department.id, next); setNotice(`${department.name} is now ${next.toLowerCase()}.`); setReload((v) => v + 1); }
    catch (err) { setNotice(err.message || 'Could not update department status.'); }
    finally { setBusyId(null); }
  }
  function editDepartment(department) { setDetail(null); setFormTarget(department); setShowForm(true); }

  return <>
    <div className="page-head dp-page-head"><div><div className="eyebrow">MASTER DATA <span>•</span> HIERARCHY &amp; FLEET ORG</div><h1>Departments</h1><p className="muted lead">Manage organizational departments, administrative leads, and employee allocations.</p></div><div className="page-head__actions"><button className="btn btn--primary" onClick={() => { setFormTarget(null); setShowForm(true); }}><Plus size={16}/> New Department</button></div></div>
    {notice && <div className="dp-notice" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Dismiss"><X size={14}/></button></div>}
    <div className="dp-summary-grid">
      <article className="dp-summary-card"><div className="dp-summary-card__top"><span>TOTAL DEPARTMENTS</span><span className="dp-summary-icon"><Building2 size={19}/></span></div><div className="dp-summary-value">{summary.total}<span className="dp-mini-pill">Organizational units</span></div><p>Registered organizational units</p></article>
      <article className="dp-summary-card"><div className="dp-summary-card__top"><span>ACTIVE DEPARTMENTS</span><span className="dp-summary-icon dp-summary-icon--green"><CheckCircle2 size={19}/></span></div><div className="dp-summary-value">{summary.active}<span className="dp-mini-pill dp-mini-pill--green">{summary.total ? `${Math.round(summary.active / summary.total * 100)}% active` : 'No departments'}</span></div><p>Available for organizational assignments</p></article>
      <article className="dp-summary-card"><div className="dp-summary-card__top"><span>UNASSIGNED EMPLOYEES</span><span className="dp-summary-icon"><UserRoundX size={19}/></span></div><div className="dp-summary-value">{summary.unassignedEmployees}<span className="dp-mini-pill dp-mini-pill--red">{summary.unassignedEmployees ? 'Action needed' : 'All assigned'}</span></div><p>Active employees pending department allocation</p></article>
    </div>
    <div className="dp-toolbar"><div className="dp-tabs" role="group" aria-label="Filter by status">{['All', 'Active', 'Inactive'].map((value) => <button key={value} className={status === value ? 'is-active' : ''} aria-pressed={status === value} onClick={() => { setStatus(value); setPage(1); }}>{value}<span>{filteredCounts[value]}</span></button>)}</div><label className="dp-search"><Search size={16}/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by department name, code, or lead..." aria-label="Search departments"/><kbd>⌘F</kbd></label><label className="dp-sort"><span>Sort:</span><select value="name" onChange={() => {}} aria-label="Sort departments"><option value="name">Name (A–Z)</option></select></label><button className="dp-refresh" onClick={() => setReload((v) => v + 1)} aria-label="Refresh departments" title="Refresh"><RefreshCw size={16}/></button></div>
    <div className={'table-card dp-table-card' + (loading && result ? ' is-loading' : '')}><div className="dp-table-scroll"><table className="table dp-table"><thead><tr><th>DEPARTMENT</th><th>CODE</th><th>DEPARTMENT HEAD</th><th>EMPLOYEES</th><th>STATUS</th><th className="ta-right">ACTIONS</th></tr></thead><tbody>
      {error ? <tr><td colSpan={6} className="dp-table-state"><p className="dp-error">{error}</p><button className="btn btn--soft" onClick={() => setReload((v) => v + 1)}>Try again</button></td></tr>
      : !result ? <tr><td colSpan={6} className="dp-table-state">Loading departments…</td></tr>
      : departments.length === 0 ? <tr><td colSpan={6} className="dp-table-state"><Building2 size={24}/><p>{query || status !== 'All' ? 'No departments match your filters.' : 'No departments have been created yet.'}</p>{!query && status === 'All' && <button className="btn btn--primary" onClick={() => { setFormTarget(null); setShowForm(true); }}><Plus size={15}/> Create Department</button>}</td></tr>
      : departments.map((d) => <tr key={d.id} className={d.status === 'Inactive' ? 'dp-row--inactive' : ''}><td><div className="dp-dept-cell"><span className="dp-dept-icon"><Building2 size={17}/></span><span><strong>{d.name}</strong><small>{d.description || 'No description provided'}</small></span></div></td><td><span className="dp-code">{d.code}</span></td><td>{d.department_head_name ? <div className="dp-head-cell"><span className="dp-avatar">{initials(d.department_head_name)}</span><span><strong>{d.department_head_name}</strong><small>Department head</small></span></div> : <em className="dp-unassigned">Not assigned</em>}</td><td><span className="dp-count-pill">{d.employee_count} {d.employee_count === 1 ? 'Employee' : 'Employees'}</span></td><td><StatusBadge tone={d.status === 'Active' ? 'green' : 'gray'}>{d.status}</StatusBadge></td><td className="ta-right"><div className="dp-actions"><button className="dp-link" onClick={() => openDetails(d)} disabled={busyId === d.id}>View</button><span>•</span><button className="dp-link dp-link--muted" onClick={() => editDepartment(d)}>Edit</button><span>•</span><div className="dp-menu-wrap"><button className="dp-link dp-link--muted" onClick={() => changeStatus(d)} disabled={busyId === d.id}>{busyId === d.id ? 'Saving…' : d.status === 'Active' ? 'Deactivate' : 'Activate'}</button><button className="dp-more" aria-label={`More actions for ${d.name}`} onClick={() => setMenuId(menuId === d.id ? null : d.id)}><Ellipsis size={16}/></button>{menuId === d.id && <div className="dp-menu"><button onClick={() => openDetails(d)}>View details</button><button onClick={() => editDepartment(d)}>Edit department</button><button onClick={() => changeStatus(d)}>{d.status === 'Active' ? 'Deactivate' : 'Activate'} department</button></div>}</div></div></td></tr>)}
    </tbody></table></div>{result && <Pagination shown={departments.length} total={result.total} noun="departments" page={result.page} pages={result.totalPages} onPageChange={setPage}/>}</div>
    {showForm && <DepartmentForm initial={formTarget} employees={employees} onSave={saveDepartment} onClose={() => { setShowForm(false); setFormTarget(null); }}/>}
    <DepartmentDetails detail={detail} onClose={() => setDetail(null)} onEdit={editDepartment}/>
  </>;
}
