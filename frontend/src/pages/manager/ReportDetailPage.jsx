import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, FileSpreadsheet, FileText, Printer, RefreshCw } from 'lucide-react';
import { api } from '../../api/client.js';
import './report-detail.css';

const META = {
  'user-directory': { title:'User directory', subtitle:'Accounts, roles, contact details and access status.', filters:['role','status'] },
  'accounts-by-role': { title:'Accounts by role and status', subtitle:'Active and inactive accounts grouped by role.', filters:[] },
  'driver-directory': { title:'Driver directory', subtitle:'Driver contact details and current availability.', filters:['availability'] },
  'driver-trip-summary': { title:'Driver trip summary', subtitle:'Trip counts, outcomes and recorded distance by driver.', filters:['period','driverId'] },
  'driver-trip-history': { title:'Driver trip history', subtitle:'Trip-by-trip history for a selected driver.', filters:['period','driverId'] },
  'fleet-register': { title:'Fleet register', subtitle:'Vehicle details, fuel type, capacity and rated efficiency.', filters:['status','vehicleTypeId','fuelTypeId'] },
  'vehicle-utilization': { title:'Vehicle utilization', subtitle:'Trip activity and recorded distance by vehicle.', filters:['period','vehicleId'] },
  'maintenance-cost': { title:'Maintenance cost', subtitle:'Service, repair and inspection costs by vehicle.', filters:['period','vehicleId'] },
  'fuel-consumption': { title:'Fuel consumption by vehicle', subtitle:'Recorded liquid fuel and electric energy, kept in separate units.', filters:['period','vehicleId','fuelTypeId'] },
  'fuel-cost-summary': { title:'Fuel cost summary', subtitle:'Recorded fuel and charging costs grouped by vehicle, fuel type or month.', filters:['period','groupBy'] },
  'expected-vs-actual': { title:'Expected vs actual consumption', subtitle:'Rated-efficiency estimates compared with fuel or energy purchased in the selected period.', filters:['period','vehicleId'] },
};
const today = () => new Date().toISOString().slice(0,10);
const past30 = () => { const d = new Date(); d.setDate(d.getDate()-29); return d.toISOString().slice(0,10); };
const DEFAULTS = { startDate:past30(), endDate:today(), role:'', status:'', availability:'', vehicleTypeId:'all', fuelTypeId:'all', vehicleId:'all', driverId:'', groupBy:'vehicle' };
const PERIOD_KEYS = new Set(['driver-trip-summary','driver-trip-history','vehicle-utilization','maintenance-cost','fuel-consumption','fuel-cost-summary','expected-vs-actual']);
const fmtStamp = (value) => new Date(value).toLocaleString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
const fmtValue = (v) => v == null || v === '' ? '—' : typeof v === 'number' ? v.toLocaleString('en-US',{maximumFractionDigits:2}) : String(v);

export default function ReportDetailPage() {
  const { reportKey } = useParams();
  const meta = META[reportKey];
  const [filters, setFilters] = useState(DEFAULTS);
  const [options, setOptions] = useState({drivers:[],vehicles:[],vehicleTypes:[],fuelTypes:[]});
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { setFilters({...DEFAULTS,startDate:past30(),endDate:today()}); setReport(null); setError(''); }, [reportKey]);
  useEffect(() => { api('/reports/options').then(setOptions).catch(() => {}); }, []);
  const change = (name) => (e) => { setFilters((current) => ({...current,[name]:e.target.value})); setReport(null); setError(''); };
  const queryString = useMemo(() => { const p = new URLSearchParams(); for (const [k,v] of Object.entries(filters)) { if (meta?.filters.includes(k) && v !== '' && v !== 'all') p.set(k,v); else if (meta?.filters.includes(k) && v === 'all') p.set(k,v); }
    if (meta?.filters.includes('period')) { p.set('startDate',filters.startDate); p.set('endDate',filters.endDate); }
    if (reportKey==='driver-trip-history' && filters.driverId) p.set('driverId',filters.driverId);
    return p.toString(); }, [filters,meta,reportKey]);

  const generate = useCallback(async (event) => {
    event?.preventDefault();
    if (PERIOD_KEYS.has(reportKey) && filters.startDate > filters.endDate) { setError('Start date must be on or before the end date.'); return; }
    if (reportKey==='driver-trip-history' && !filters.driverId) { setError('Choose a driver before generating this report.'); return; }
    setLoading(true); setError('');
    try { const result = await api(`/reports/${reportKey}?${queryString}`); setReport(result.report); }
    catch (err) { setReport(null); setError(err.message || 'Could not generate this report.'); }
    finally { setLoading(false); }
  }, [filters,queryString,reportKey]);

  const download = async (format) => {
    setExporting(format); setError('');
    try {
      const applied = report?.filters || filters;
      const exportParams = new URLSearchParams();
      if (PERIOD_KEYS.has(reportKey)) { exportParams.set('startDate', applied.start || applied.startDate); exportParams.set('endDate', applied.end || applied.endDate); }
      for (const key of ['role','status','availability','vehicleTypeId','fuelTypeId','vehicleId','driverId','groupBy']) {
        const value = applied[key]; if (value !== undefined && value !== '' && value !== 'all') exportParams.set(key, value);
      }
      exportParams.set('format', format);
      const response = await fetch(`/api/reports/${reportKey}/export?${exportParams.toString()}`,{credentials:'include'});
      if (!response.ok) { let msg='Could not export this report.'; try { msg=(await response.json()).error||msg; } catch {} throw new Error(msg); }
      const blob = await response.blob(); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download=`${reportKey}-${today()}.${format}`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    } catch (err) { setError(err.message || 'Could not export this report.'); }
    finally { setExporting(''); }
  };
  if (!meta) return <section className="report-detail"><Link className="report-back" to="/manager/reports"><ArrowLeft size={16}/> Back to reports</Link><h1>Report not found</h1><p>This report type does not exist.</p></section>;

  return <section className="report-detail">
    <Link className="report-back" to="/manager/reports"><ArrowLeft size={16}/> Back to reports</Link>
    <div className="report-detail__heading"><div><div className="report-detail__eyebrow">MANAGEMENT · REPORTS</div><h1>{meta.title}</h1><p>{meta.subtitle}</p></div></div>
    <form className="report-filters" onSubmit={generate}>
      <div className="report-filters__fields">
        {PERIOD_KEYS.has(reportKey) && <><label>Start date<input type="date" value={filters.startDate} max={filters.endDate} onChange={change('startDate')} required /></label><label>End date<input type="date" value={filters.endDate} min={filters.startDate} max={today()} onChange={change('endDate')} required /></label></>}
        {meta.filters.includes('role') && <label>Role<select value={filters.role} onChange={change('role')}><option value="">All roles</option><option value="Manager">Officer / Manager</option><option value="Driver">Driver</option><option value="System Administrator">System Administrator</option></select></label>}
        {meta.filters.includes('status') && <label>Status<select value={filters.status} onChange={change('status')}><option value="">All statuses</option><option>Active</option><option>Inactive</option>{reportKey==='fleet-register' && <><option>Out of Service</option><option>Returned to Provider</option></>}</select></label>}
        {meta.filters.includes('availability') && <label>Availability<select value={filters.availability} onChange={change('availability')}><option value="">All availability</option><option>Available</option><option>On trip</option><option>Inactive</option></select></label>}
        {meta.filters.includes('driverId') && <label>Driver<select value={filters.driverId} onChange={change('driverId')} required={reportKey==='driver-trip-history'}><option value="">{reportKey==='driver-trip-history'?'Select driver (required)':'All drivers'}</option>{options.drivers.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label>}
        {meta.filters.includes('vehicleId') && <label>Vehicle<select value={filters.vehicleId} onChange={change('vehicleId')}><option value="all">All vehicles</option>{options.vehicles.map(v=><option key={v.id} value={v.id}>{[v.brand_name,v.model_name].filter(Boolean).join(' ')} · {v.plate_number}</option>)}</select></label>}
        {meta.filters.includes('vehicleTypeId') && <label>Vehicle type<select value={filters.vehicleTypeId} onChange={change('vehicleTypeId')}><option value="all">All types</option>{options.vehicleTypes.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</select></label>}
        {meta.filters.includes('fuelTypeId') && <label>Fuel type<select value={filters.fuelTypeId} onChange={change('fuelTypeId')}><option value="all">All fuel types</option>{options.fuelTypes.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</select></label>}
        {meta.filters.includes('groupBy') && <label>Group by<select value={filters.groupBy} onChange={change('groupBy')}><option value="vehicle">Vehicle</option><option value="fuelType">Fuel type</option><option value="month">Month</option></select></label>}
      </div>
      <div className="report-filters__actions"><button className="report-generate" type="submit" disabled={loading}><RefreshCw size={16} className={loading?'spin':''}/>{loading?'Generating…':'Generate report'}</button></div>
    </form>
    {error && <div className="report-error" role="alert">{error}</div>}
    {report && <div className="report-result" id="report-print-area">
      <div className="report-result__top"><div><div className="report-detail__eyebrow">GENERATED REPORT</div><h2>{report.title}</h2><p>Generated {fmtStamp(report.generatedAt)} by {report.generatedBy} · {report.periodLabel}</p></div>
        <div className="report-export-actions"><button type="button" onClick={()=>download('xlsx')} disabled={!!exporting}><FileSpreadsheet size={16}/>{exporting==='xlsx'?'Preparing…':'Download Excel'}</button><button type="button" onClick={()=>download('docx')} disabled={!!exporting}><FileText size={16}/>{exporting==='docx'?'Preparing…':'Download Word'}</button><button type="button" onClick={()=>window.print()}><Printer size={16}/>Print / Save as PDF</button></div>
      </div>
      {report.summary?.length>0 && <div className="report-summary">{report.summary.map((s)=><div className="report-summary__item" key={s.label}><span>{s.label}</span><strong>{fmtValue(s.value)}</strong></div>)}</div>}
      {report.rows.length===0 ? <div className="report-empty"><strong>No data for this selection</strong><span>Try adjusting the filters or date range, then generate the report again.</span></div> : <div className="report-table-wrap"><table className="report-table"><thead><tr>{report.columns.map((c,i)=><th key={`${c}-${i}`}>{c}</th>)}</tr></thead><tbody>{report.rows.map((row,ri)=><tr key={ri}>{row.map((value,ci)=><td key={ci}>{fmtValue(value)}</td>)}</tr>)}</tbody></table></div>}
      {report.notes?.map((note,i)=><p className="report-note" key={i}>{note}</p>)}
    </div>}
  </section>;
}
