import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, CheckCircle2, Clock3, GitFork, LoaderCircle,
  MapPin, RefreshCw, Route, ShieldCheck, Truck, UserRound,
} from 'lucide-react';
import { assignTrip, getAssignmentDetails, listTripRequests } from '../../api/tripRequests.api.js';
import './assign-trip.css';

const requestRef = (id) => `TRP-${String(id).padStart(4, '0')}`;
const tripTypeLabel = (type) => type === 'One-way' ? 'ONE-WAY' : type === 'Round Trip' ? 'ROUND-TRIP' : 'WITH CHECKPOINTS';
const initials = (name = '') => name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();

export default function AssignTripPage() {
  const { requestId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [selectedDriver, setSelectedDriver] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (!requestId) {
        const result = await listTripRequests({ page: 1, pageSize: 50 });
        setPendingRequests((result.requests || []).filter((item) => item.status === 'Pending'));
        setData(null);
      } else {
        const result = await getAssignmentDetails(requestId);
        setData(result);
        setSelectedVehicle('');
        setSelectedDriver('');
      }
    } catch (err) {
      setError(err.message || 'Could not load assignment information.');
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => { load(); }, [load]);

  async function confirmAssignment() {
    if (!data?.request) return;
    if (!selectedVehicle || !selectedDriver) {
      setError('Select both an available vehicle and an available driver.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await assignTrip(data.request.id, {
        vehicleId: Number(selectedVehicle),
        driverId: Number(selectedDriver),
      });
      navigate('/manager/queue', { state: { assignmentNotice: `Trip ${requestRef(data.request.id)} assigned successfully.` } });
    } catch (err) {
      setError(err.message || 'Could not assign this trip.');
      if (err.status === 409) await load();
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="assign-state"><LoaderCircle className="assign-spinner" size={24} /><span>Loading assignment details…</span></div>;
  }

  if (!requestId) {
    return (
      <div className="assign-page">
        <div className="assign-breadcrumb"><span>Dispatch Queue</span><span>/</span><strong>Assign Trip</strong></div>
        <div className="assign-heading"><div><div className="assign-eyebrow">DISPATCH OPERATIONS</div><h1>Assign Trip</h1><p>Choose a pending trip request to assign a vehicle and driver.</p></div><span className="assign-system"><i /> System Operational</span></div>
        {error && <div className="assign-alert" role="alert">{error}</div>}
        <section className="assign-card assign-pending-card">
          <div className="assign-card-title"><div><h2>Pending Requests</h2><p>Requests awaiting vehicle and driver assignment</p></div><button className="assign-icon-button" onClick={load} aria-label="Refresh requests"><RefreshCw size={16} /></button></div>
          {pendingRequests.length === 0 ? <div className="assign-empty"><CheckCircle2 size={24} /><strong>You're all caught up</strong><span>There are no pending requests to assign.</span><button className="assign-button assign-button--primary" onClick={() => navigate('/manager/new-request')}>Create New Request <ArrowRight size={16} /></button></div> : (
            <div className="assign-request-list">
              {pendingRequests.map((request) => (
                <button className="assign-request-row" key={request.id} onClick={() => navigate(`/manager/assign-trip/${request.id}`)}>
                  <span className="assign-request-avatar">{initials(request.employee_name)}</span>
                  <span className="assign-request-main"><strong>{request.employee_name}</strong><small>{request.department || 'No department'} · {request.destination}</small></span>
                  <span className="assign-request-meta"><code>{requestRef(request.id)}</code><small>{tripTypeLabel(request.trip_type)}</small></span>
                  <ArrowRight size={17} />
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    );
  }

  const request = data?.request;
  if (!request) return <div className="assign-state assign-state--error">{error || 'Trip request not found.'}<button className="assign-button" onClick={() => navigate('/manager/queue')}>Back to Dispatch Queue</button></div>;

  const selectedVehicleInfo = data.vehicles.find((vehicle) => String(vehicle.id) === selectedVehicle);
  const selectedDriverInfo = data.drivers.find((driver) => String(driver.id) === selectedDriver);
  const unavailableRequest = request.status !== 'Pending';

  return (
    <div className="assign-page">
      <div className="assign-breadcrumb"><button onClick={() => navigate('/manager/queue')}><ArrowLeft size={15} /> Dispatch Queue</button><span>/</span><strong>{requestRef(request.id)}</strong></div>
      <div className="assign-heading"><div><div className="assign-eyebrow">DISPATCH OPERATIONS</div><h1>Assign Trip #{requestRef(request.id)}</h1></div><span className={`assign-status ${unavailableRequest ? 'assign-status--muted' : ''}`}><i /> {unavailableRequest ? request.status : 'Ready for Dispatch'}</span></div>
      <div className="assign-routing-id">System Routing ID: RT-{String(request.id).padStart(4, '0')}-E</div>

      <section className="assign-request-summary">
        <span className="assign-summary-person"><UserRound size={16} /><strong>{request.employee_name}</strong></span>
        <span className="assign-summary-dot">•</span><span>{request.department || 'No department'}</span>
        <span className="assign-summary-dot">•</span><span className="assign-summary-destination"><MapPin size={16} /> Destination: {request.destination}</span>
        <span className="assign-summary-dot">•</span><span className="assign-type-chip">{tripTypeLabel(request.trip_type)}</span>
      </section>

      {error && <div className="assign-alert" role="alert">{error}</div>}
      {unavailableRequest && <div className="assign-alert assign-alert--info">This request is already {request.status.toLowerCase()}. A new assignment cannot be created from this page.</div>}

      <div className="assign-resource-grid">
        <section className="assign-resource-column">
          <div className="assign-column-heading"><h2>Available Vehicles</h2><span>({data.vehicles.length} Available)</span></div>
          <div className="assign-resource-list">
            {data.vehicles.length === 0 ? <div className="assign-empty-small">No available vehicles found.</div> : data.vehicles.map((vehicle) => {
              const active = selectedVehicle === String(vehicle.id);
              return <button key={vehicle.id} type="button" disabled={unavailableRequest} className={`assign-resource-card ${active ? 'is-selected' : ''}`} onClick={() => setSelectedVehicle(String(vehicle.id))}>
                <span className={`assign-radio ${active ? 'is-checked' : ''}`}>{active && <span />}</span>
                <span className="assign-resource-copy"><strong>{vehicle.plate_number}</strong><small>{vehicle.vehicle_type || 'Vehicle'}{vehicle.fuel_type ? ` (${vehicle.fuel_type})` : ''}</small></span>
                <span className={`assign-select-label ${active ? 'is-selected' : ''}`}>{active ? 'Selected' : 'Select'}</span>
              </button>;
            })}
          </div>
        </section>

        <section className="assign-resource-column">
          <div className="assign-column-heading"><h2>Available Drivers</h2><span>({data.drivers.length} Available)</span></div>
          <div className="assign-resource-list">
            {data.drivers.length === 0 ? <div className="assign-empty-small">No available drivers found.</div> : data.drivers.map((driver) => {
              const active = selectedDriver === String(driver.id);
              return <button key={driver.id} type="button" disabled={unavailableRequest} className={`assign-resource-card ${active ? 'is-selected' : ''}`} onClick={() => setSelectedDriver(String(driver.id))}>
                <span className={`assign-radio ${active ? 'is-checked' : ''}`}>{active && <span />}</span>
                <span className="assign-resource-copy"><strong>{driver.name}</strong><small>{driver.phone || 'No phone number on file'}</small></span>
                <span className={`assign-select-label ${active ? 'is-selected' : ''}`}>{active ? 'Selected' : 'Select'}</span>
              </button>;
            })}
          </div>
        </section>
      </div>

      {request.checkpoints?.length > 0 && <section className="assign-card assign-checkpoints"><div className="assign-card-title"><div><h2><GitFork size={17} /> Route checkpoints</h2><p>{request.checkpoints.length} intermediate stop{request.checkpoints.length === 1 ? '' : 's'}</p></div><Route size={18} /></div><ol>{request.checkpoints.map((stop) => <li key={stop.id || stop.sequenceOrder}><span>{stop.sequenceOrder}</span>{stop.location}</li>)}</ol></section>}

      <div className="assign-confirm-bar">
        <div className="assign-confirm-icon"><ShieldCheck size={23} /></div>
        <div className="assign-confirm-copy"><span>CURRENT SELECTION</span><strong>{selectedVehicleInfo && selectedDriverInfo ? `Selected: ${selectedVehicleInfo.plate_number} (${selectedVehicleInfo.vehicle_type || 'Vehicle'}) & ${selectedDriverInfo.name}` : 'Select one vehicle and one driver to continue'}</strong></div>
        <button className="assign-button assign-button--ghost" onClick={() => navigate('/manager/queue')} disabled={saving}>Cancel</button>
        <button className="assign-button assign-button--primary" onClick={confirmAssignment} disabled={saving || unavailableRequest || !selectedVehicle || !selectedDriver}>{saving ? 'Confirming…' : 'Confirm Assignment & Notify'} {saving ? <LoaderCircle className="assign-spinner" size={16} /> : <ArrowRight size={17} />}</button>
      </div>
      <div className="assign-footnote"><Clock3 size={14} /> Assignment is saved to the dispatch record. Driver notifications are not configured in this version.</div>
    </div>
  );
}
