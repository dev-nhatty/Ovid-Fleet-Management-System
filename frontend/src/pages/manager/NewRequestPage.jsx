import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BadgeCheck, Building2, CheckCircle2, Circle, Clock3, GripVertical, MapPin,
  Phone, PlusCircle, Route, Trash2, UserRoundSearch, X,
} from 'lucide-react';
import { createTripRequest, searchEmployees } from '../../api/tripRequests.api.js';
import './new-request.css';

const blankForm = {
  employee: null,
  employeeQuery: '',
  tripType: 'With Checkpoints',
  destination: '',
  checkpoints: [],
};


export default function NewRequestPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState(blankForm);
  const [matches, setMatches] = useState([]);
  const [searching, setSearching] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [fields, setFields] = useState({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    const q = form.employeeQuery.trim();
    if (form.employee || q.length < 1) {
      setMatches([]);
      setSearching(false);
      setLookupError('');
      return undefined;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const result = await searchEmployees(q);
        if (!cancelled) {
          setMatches(result.employees || []);
          setLookupError('');
        }
      } catch (err) {
        if (!cancelled) setLookupError(err.message || 'Could not search the employee directory.');
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [form.employeeQuery, form.employee]);

  const update = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setFields((current) => ({ ...current, [key]: undefined }));
    setError('');
  };

  function selectEmployee(employee) {
    setForm((current) => ({
      ...current,
      employee,
      employeeQuery: `${employee.name} (${employee.id})`,
    }));
    setMatches([]);
    setFields((current) => ({ ...current, employeeId: undefined }));
  }

  function changeTripType(type) {
    setForm((current) => ({
      ...current,
      tripType: type,
      checkpoints: type === 'With Checkpoints' ? current.checkpoints : [],
    }));
    setFields((current) => ({ ...current, tripType: undefined, checkpoints: undefined }));
  }

  function addCheckpoint() {
    setForm((current) => ({
      ...current,
      checkpoints: [...current.checkpoints, { key: `${Date.now()}-${Math.random()}`, location: '' }],
    }));
  }

  function updateCheckpoint(key, patch) {
    setForm((current) => ({
      ...current,
      checkpoints: current.checkpoints.map((stop) => stop.key === key ? { ...stop, ...patch } : stop),
    }));
    setFields((current) => ({ ...current, checkpoints: undefined }));
  }

  function removeCheckpoint(key) {
    setForm((current) => ({ ...current, checkpoints: current.checkpoints.filter((stop) => stop.key !== key) }));
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    setSuccess(null);
    setFields({});
    if (!form.employee) {
      setFields({ employeeId: 'Choose an employee from the directory.' });
      setError('Please choose an employee from the directory.');
      return;
    }
    setSaving(true);
    try {
      const result = await createTripRequest({
        employeeId: form.employee.id,
        tripType: form.tripType,
        destination: form.destination,
        checkpoints: form.checkpoints.map(({ location }) => ({ location: location.trim() })),
      });
      navigate(`/manager/assign-trip/${result.id}`);
    } catch (err) {
      setError(err.message || 'Could not create the trip request.');
      setFields(err.fields || {});
    } finally {
      setSaving(false);
    }
  }

  if (success) {
    return (
      <div className="request-success">
        <div className="request-success__icon"><CheckCircle2 size={34} /></div>
        <div className="request-eyebrow">DISPATCH OPERATIONS</div>
        <h1>Trip request created</h1>
        <p>Your request has been saved and added to the dispatch queue.</p>
        <div className="request-success__summary">
          <span>Request reference</span><strong>REQ-{String(success.id).padStart(6, '0')}</strong>
          <span>Employee</span><strong>{form.employee.name}</strong>
          <span>Trip mode</span><strong>{success.trip_type}</strong>
          <span>Status</span><strong className="request-status"><i /> Pending assignment</strong>
        </div>
        <div className="request-success__actions">
          <button className="request-btn request-btn--secondary" onClick={() => navigate('/manager/queue')}>Back to Queue</button>
          <button className="request-btn request-btn--primary" onClick={() => { setForm(blankForm); setSuccess(null); setFields({}); }}>Create Another Request</button>
        </div>
      </div>
    );
  }

  return (
    <form className="new-request-page" onSubmit={submit} noValidate>
      <div className="request-page-heading">
        <div><div className="request-eyebrow">DISPATCH OPERATIONS</div><h1>New Trip Request</h1></div>
        <span className="request-secure"><span /> System Operational</span>
      </div>

      {error && <div className="request-alert" role="alert">{error}</div>}

      <div className="request-layout">
        <section className="request-card request-form-card">
          <div className="request-section-title"><h2>Caller Information</h2><span className="request-directory"><BadgeCheck size={15} /> Directory Lookup</span></div>
          <div className="request-field request-field--wide request-employee-field">
            <label htmlFor="employee">EMPLOYEE NAME OR ID <b>*</b></label>
            <div className="request-input-wrap">
              <UserRoundSearch size={18} />
              <input id="employee" autoComplete="off" value={form.employeeQuery}
                placeholder="Search employee name or ID..." aria-invalid={Boolean(fields.employeeId)}
                onChange={(e) => {
                  setForm((current) => ({ ...current, employee: null, employeeQuery: e.target.value }));
                  setFields((current) => ({ ...current, employeeId: undefined }));
                }} />
              {form.employee && <button type="button" className="request-clear" onClick={() => setForm((current) => ({ ...current, employee: null, employeeQuery: '' }))} aria-label="Clear employee"><X size={15} /></button>}
            </div>
            {fields.employeeId && <small className="request-field-error">{fields.employeeId}</small>}
            {lookupError && <small className="request-field-error">{lookupError}</small>}
            {searching && <div className="request-search-state">Searching directory…</div>}
            {!searching && matches.length > 0 && (
              <div className="request-suggestions">
                {matches.map((employee) => (
                  <button type="button" key={employee.id} onClick={() => selectEmployee(employee)}>
                    <span className="request-suggestion-avatar">{employee.name.split(' ').map((x) => x[0]).slice(0, 2).join('')}</span>
                    <span><strong>{employee.name}</strong><small>{employee.department || 'No department'} · ID {employee.id}</small></span>
                    <span className="request-suggestion-phone">{employee.phone || 'No phone'}</span>
                  </button>
                ))}
              </div>
            )}
            {form.employee && (
              <div className="request-employee-details">
                <div><Building2 size={15} /><span>{form.employee.department || 'No department assigned'}</span></div>
                <div><Phone size={15} /><span>{form.employee.phone || 'No contact phone on file'}</span></div>
              </div>
            )}
            {!searching && form.employeeQuery.trim() && !form.employee && matches.length === 0 && !lookupError && (
              <div className="request-search-state">Choose a matching employee from the results to continue.</div>
            )}
          </div>

          <div className="request-field request-field--wide">
            <label>TRIP MODE <b>*</b></label>
            <div className="request-trip-modes" role="group" aria-label="Trip mode">
              {['One-way', 'Round Trip', 'With Checkpoints'].map((type) => (
                <button key={type} type="button" className={form.tripType === type ? 'is-selected' : ''}
                  onClick={() => changeTripType(type)}>{type}</button>
              ))}
            </div>
            {fields.tripType && <small className="request-field-error">{fields.tripType}</small>}
          </div>


          <div className="request-field request-field--wide">
            <label htmlFor="destination">PRIMARY DESTINATION <b>*</b></label>
            <div className="request-input-wrap"><MapPin size={17} /><input id="destination" maxLength={255} value={form.destination}
              aria-invalid={Boolean(fields.destination)} placeholder="Enter destination / facility" onChange={(e) => update('destination', e.target.value)} /></div>
            {fields.destination && <small className="request-field-error">{fields.destination}</small>}
          </div>

          {form.tripType === 'With Checkpoints' && (
            <div className="request-field request-field--wide">
              <div className="request-stops-heading"><label>INTERMEDIATE STOPS <span className="request-count">{form.checkpoints.length}</span></label>
                <button type="button" className="request-text-button" onClick={addCheckpoint} disabled={form.checkpoints.length >= 20}><PlusCircle size={15} /> Add Checkpoint</button></div>
              {form.checkpoints.map((stop, index) => (
                <div className="request-stop-row" key={stop.key}>
                  <GripVertical size={15} className="request-grip" />
                  <span className="request-stop-number">{index + 1}</span>
                  <input aria-label={`Checkpoint ${index + 1} location`} maxLength={255} value={stop.location}
                    placeholder={`Checkpoint ${index + 1} location`}
                    onChange={(e) => updateCheckpoint(stop.key, { location: e.target.value })} />
                  <button type="button" className="request-remove-stop" onClick={() => removeCheckpoint(stop.key)} aria-label={`Remove checkpoint ${index + 1}`}><Trash2 size={15} /></button>
                </div>
              ))}
              {fields.checkpoints && <small className="request-field-error">{fields.checkpoints}</small>}
              {Object.entries(fields).filter(([key]) => key.startsWith('checkpoint_')).map(([key, message]) => <small key={key} className="request-field-error">{message}</small>)}
            </div>
          )}


        </section>

        <aside className="request-side-column">
          <section className="request-card request-route-card">
            <div className="request-section-title"><h2><Route size={17} /> Route & Checkpoints Preview</h2><span className="request-waypoint-count">{form.checkpoints.length + 1} Waypoints</span></div>
            <div className="request-timeline">
              <div className="request-timeline-item request-timeline-origin">
                <span className="request-timeline-dot"><Circle size={14} /></span><div><small>ORIGIN</small><strong>Origin not recorded</strong><p>Origin tracking is not part of the current database schema</p></div><time>08:30</time>
              </div>
              {form.checkpoints.map((stop, i) => (
                <div className="request-timeline-item" key={stop.key}>
                  <span className="request-timeline-dot"><MapPin size={14} /></span><div><small>CHECKPOINT {i + 1}</small><strong>{stop.location || `Checkpoint ${i + 1}`}</strong><p>Intermediate stop</p></div><time>Stop {i + 1}</time>
                </div>
              ))}
              <div className="request-timeline-item request-timeline-destination">
                <span className="request-timeline-dot"><MapPin size={14} /></span><div><small>FINAL DESTINATION</small><strong>{form.destination || 'Destination'}</strong><p>{form.tripType === 'Round Trip' ? 'Round trip requested' : form.tripType}</p></div><time>Destination</time>
              </div>
            </div>
            <p className="request-preview-note"><Clock3 size={14} /> Preview is indicative only; actual travel time is set during dispatch.</p>
          </section>

          <section className="request-card request-resource-card">
            <div className="request-section-title"><h2>Request Summary</h2><span className="request-summary-status"><i /> Draft</span></div>
            <div className="request-summary-line"><span>Employee</span><strong>{form.employee?.name || 'Not selected'}</strong></div>
            <div className="request-summary-line"><span>Department</span><strong>{form.employee?.department || '—'}</strong></div>
            <div className="request-summary-line"><span>Trip mode</span><strong>{form.tripType}</strong></div>
            <div className="request-summary-line"><span>Checkpoints</span><strong>{form.checkpoints.length}</strong></div>
            <div className="request-summary-foot">Vehicle and driver assignment happens after the request is created.</div>
          </section>
        </aside>
      </div>

      <div className="request-form-footer">
        <button type="button" className="request-btn request-btn--secondary" onClick={() => navigate('/manager/queue')} disabled={saving}>Cancel</button>
        <button type="submit" className="request-btn request-btn--primary" disabled={saving}>{saving ? 'Creating request…' : 'Create & Proceed to Assign'} <span>→</span></button>
      </div>
    </form>
  );
}
