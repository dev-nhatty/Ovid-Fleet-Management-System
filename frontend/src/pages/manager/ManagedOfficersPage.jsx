import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, UserRoundPlus, UserRound, CircleCheck, CircleAlert, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { listManagedOfficers, updateManagedOfficerStatus } from '../../api/managedOfficers.api.js';
import './managed-officers.css';

export default function ManagedOfficersPage() {
  const [officers, setOfficers] = useState([]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const data = await listManagedOfficers({ q, status });
      setOfficers(data.officers || []);
    } catch (err) { setError(err.message || 'Unable to load officers.'); }
    finally { setLoading(false); }
  }, [q, status]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [q, status]);

  const totalPages = Math.max(1, Math.ceil(officers.length / pageSize));
  const visible = officers.slice((page - 1) * pageSize, page * pageSize);
  async function confirmStatus() {
    if (!selected || saving) return;
    setSaving(true); setError('');
    try {
      await updateManagedOfficerStatus(selected.id, selected.nextStatus);
      setNotice(`${selected.name}'s status was changed to ${selected.nextStatus}.`);
      setSelected(null); await load();
    } catch (err) { setError(err.message || 'Could not update officer status.'); setSelected(null); }
    finally { setSaving(false); }
  }
  return (
    <section className="mo-page">
      <header className="mo-list-heading">
        <div><div className="mo-eyebrow">MANAGEMENT</div><h1>Officers</h1><p>Create officer accounts and manage their status</p></div>
        <Link className="mo-button" to="/manager/officers/new"><UserRoundPlus size={17}/> New Officer</Link>
      </header>
      {notice && <div className="mo-notice"><CircleCheck size={17}/><span>{notice}</span><button onClick={()=>setNotice('')} aria-label="Dismiss"><X size={16}/></button></div>}
      {error && <div className="mo-banner" role="alert"><CircleAlert size={17}/>{error}</div>}
      <div className="mo-toolbar">
        <label className="mo-status-filter"><span className="mo-sr-only">Filter by status</span><select value={status} onChange={e=>setStatus(e.target.value)}><option value="">All Statuses</option><option value="Active">Active</option><option value="Inactive">Inactive</option></select></label>
        <label className="mo-search"><Search size={17}/><span className="mo-sr-only">Filter by name or username</span><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Filter by name or username…"/><kbd>⌘F</kbd></label>
      </div>
      <div className="mo-table-wrap">
        <table className="mo-table"><thead><tr><th>Officer name</th><th>Username</th><th>Phone</th><th>Status</th><th>Last active</th><th>Actions</th></tr></thead>
          <tbody>{loading ? <tr><td colSpan="6" className="mo-empty">Loading officers…</td></tr> : visible.length === 0 ? <tr><td colSpan="6" className="mo-empty">No officers match your filters.</td></tr> : visible.map(o=><tr key={o.id}>
            <td><span className="mo-person"><span className="mo-avatar">{o.name.split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase()}</span><span>{o.name}{o.isHigherOfficer && <small>Higher Officer</small>}</span></span></td>
            <td>{o.username || '—'}</td><td>{o.phone || '—'}</td>
            <td><span className={'mo-status '+(o.status==='Active'?'is-active':'is-inactive')}>{o.status}</span></td>
            <td>—</td>
            <td>{o.isHigherOfficer ? <span className="mo-protected">Protected</span> : <button className="mo-text-button" onClick={()=>setSelected({id:o.id,name:o.name,currentStatus:o.status,nextStatus:o.status==='Active'?'Inactive':'Active'})}>Change Status</button>}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <div className="mo-pagination"><span>Showing {officers.length ? (page-1)*pageSize+1 : 0}–{Math.min(page*pageSize,officers.length)} of {officers.length} officers</span><div><button disabled={page<=1} onClick={()=>setPage(p=>p-1)}><ChevronLeft size={15}/> Previous</button><span>Page {page} of {totalPages}</span><button disabled={page>=totalPages} onClick={()=>setPage(p=>p+1)}>Next <ChevronRight size={15}/></button></div></div>
      {selected && <div className="mo-modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setSelected(null);}}><section className="mo-modal" role="dialog" aria-modal="true" aria-labelledby="mo-modal-title"><button className="mo-modal-close" onClick={()=>setSelected(null)} aria-label="Close"><X size={18}/></button><h2 id="mo-modal-title">Change status</h2><p className="mo-modal-name">{selected.name}</p><div className="mo-status-transition"><span className={'mo-status '+(selected.currentStatus==='Active'?'is-active':'is-inactive')}>{selected.currentStatus}</span><span>→</span><span className={'mo-status '+(selected.nextStatus==='Active'?'is-active':'is-inactive')}>{selected.nextStatus}</span></div><div className="mo-rule"><strong>What happens?</strong><p>{selected.nextStatus==='Inactive' ? "They will be signed out and won't be able to sign in until reactivated. Their records are kept." : 'They will be able to sign in again.'}</p></div><div className="mo-actions"><button className="mo-button" onClick={()=>setSelected(null)}>Cancel</button><button className="mo-button mo-button--primary" disabled={saving} onClick={confirmStatus}>{saving?'Saving…':`Set to ${selected.nextStatus}`}</button></div></section></div>}
    </section>
  );
}
