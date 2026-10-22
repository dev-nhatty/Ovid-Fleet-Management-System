import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, CheckCircle2, Clock3, GitFork, LoaderCircle,
  MapPin, RefreshCw, Route, Search, ShieldCheck, Truck, UserRound,
} from 'lucide-react';
import { assignTrip, getAssignmentDetails, listTripRequests } from '../../api/tripRequests.api.js';
import './assign-trip.css';
import { getVehicleName } from '../../utils/vehicleDisplay.js';

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
  const [resourceTab, setResourceTab] = useState('vehicle');
  const [vehicleSearch, setVehicleSearch] = useState('');
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState('');
  const [fuelTypeFilter, setFuelTypeFilter] = useState('');
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
        setResourceTab('vehicle');
        setVehicleSearch('');
        setVehicleTypeFilter('');
        setFuelTypeFilter('');
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
    const requiredPassengerSeats = 1 + Number(data.request.additional_passenger_count || 0);
    const availablePassengerSeats = selectedVehicleInfo?.seat_capacity == null ? null : Number(selectedVehicleInfo.seat_capacity) - 1;
    const capacityMismatch = availablePassengerSeats == null || requiredPassengerSeats > availablePassengerSeats;
    let capacityOverride = false;
    if (capacityMismatch) {
      const detail = availablePassengerSeats == null
        ? 'This vehicle has no recorded total seat capacity. The driver seat must be reserved, and capacity cannot be verified.'
        : `This trip needs ${requiredPassengerSeats} passenger seats, but the selected vehicle has only ${availablePassengerSeats} passenger seats after reserving the driver's seat.`;
      if (!window.confirm(`${detail}\n\nDo you want to override this warning and assign the vehicle?`)) return;
      capacityOverride = true;
    }
    setSaving(true);
    setError('');
    try {
      await assignTrip(data.request.id, {
        vehicleId: Number(selectedVehicle),
        driverId: Number(selectedDriver),
        capacityOverride,
      });
      navigate('/manager/queue', {
        state: {
          assignmentNotice: `Trip ${requestRef(data.request.id)} assigned successfully.`,
          assignedRequestId: Number(data.request.id),
        },
      });
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
                  <span className="assign-request-main"><strong>{request.employee_name}</strong><small>{request.department || 'No department'} · {request.destination} · {Number(request.additional_passenger_count || 0)} additional passenger(s)</small></span>
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

  const vehicleTypes = [...new Set(data.vehicles.map((vehicle) => String(vehicle.vehicle_type || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const fuelTypes = [...new Set(data.vehicles.map((vehicle) => String(vehicle.fuel_type || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const normalizedVehicleSearch = vehicleSearch.trim().toLowerCase();
  const filteredVehicles = data.vehicles.filter((vehicle) => {
    const searchableText = [
      vehicle.plate_number,
      vehicle.brand_name,
      vehicle.model_name,
      getVehicleName(vehicle),
      vehicle.vehicle_type,
      vehicle.fuel_type,
    ].filter(Boolean).join(' ').toLowerCase();
    return (!normalizedVehicleSearch || searchableText.includes(normalizedVehicleSearch))
      && (!vehicleTypeFilter || String(vehicle.vehicle_type || '') === vehicleTypeFilter)
      && (!fuelTypeFilter || String(vehicle.fuel_type || '') === fuelTypeFilter);
  });
  const selectedVehicleInfo = data.vehicles.find((vehicle) => String(vehicle.id) === selectedVehicle);
  const vehicleDisplayName = getVehicleName
  const selectedDriverInfo = data.drivers.find((driver) => String(driver.id) === selectedDriver);
  const unavailableRequest = request.status !== 'Pending';
  const plannedDistanceKm = Number(request.planned_distance_km);
  const hasPlannedDistance = Number.isFinite(plannedDistanceKm) && plannedDistanceKm > 0;
  const selectedFuelName = String(selectedVehicleInfo?.fuel_type || '');
  const selectedIsElectric = /electric|\bev\b|battery/i.test(selectedFuelName);
  const estimatedFuelLiters = hasPlannedDistance && Number(selectedVehicleInfo?.fuel_efficiency_km_per_l) > 0 ? plannedDistanceKm / Number(selectedVehicleInfo.fuel_efficiency_km_per_l) : null;
  const estimatedElectricKwh = hasPlannedDistance && Number(selectedVehicleInfo?.energy_consumption_kwh_per_100km) > 0 ? plannedDistanceKm * Number(selectedVehicleInfo.energy_consumption_kwh_per_100km) / 100 : null;

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
        <span className="assign-summary-dot">•</span><span className="assign-passenger-chip">{1 + Number(request.additional_passenger_count || 0)} passenger seats needed ({Number(request.additional_passenger_count || 0)} additional)</span>{hasPlannedDistance && <><span className="assign-summary-dot">•</span><span>{plannedDistanceKm.toLocaleString()} km planned</span></>}
      </section>

      {error && <div className="assign-alert" role="alert">{error}</div>}
      {unavailableRequest && <div className="assign-alert assign-alert--info">This request is already {request.status.toLowerCase()}. A new assignment cannot be created from this page.</div>}

      <section className="assign-resource-panel">
        <div className="assign-tabs" role="tablist" aria-label="Choose vehicle and driver">
          <button type="button" role="tab" aria-selected={resourceTab === 'vehicle'} className={`assign-tab ${resourceTab === 'vehicle' ? 'is-active' : ''}`} onClick={() => setResourceTab('vehicle')}>Vehicle <span>{data.vehicles.length}</span></button>
          <button type="button" role="tab" aria-selected={resourceTab === 'driver'} className={`assign-tab ${resourceTab === 'driver' ? 'is-active' : ''}`} onClick={() => setResourceTab('driver')}>Driver <span>{data.drivers.length}</span></button>
        </div>
        {resourceTab === 'vehicle' ? (
          <div role="tabpanel">
            <div className="assign-vehicle-filters" aria-label="Filter available vehicles">
              <div className="assign-vehicle-filter-field assign-vehicle-filter-search">
                <label htmlFor="assign-vehicle-search">Search vehicles</label>
                <div className="assign-vehicle-search-input"><Search size={16} aria-hidden="true" /><input id="assign-vehicle-search" type="search" value={vehicleSearch} onChange={(event) => setVehicleSearch(event.target.value)} placeholder="Plate number, make, or model" /></div>
              </div>
              <div className="assign-vehicle-filter-field">
                <label htmlFor="assign-vehicle-type">Vehicle type</label>
                <select id="assign-vehicle-type" value={vehicleTypeFilter} onChange={(event) => setVehicleTypeFilter(event.target.value)}>
                  <option value="">All vehicle types</option>
                  {vehicleTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
              </div>
              <div className="assign-vehicle-filter-field">
                <label htmlFor="assign-fuel-type">Fuel type</label>
                <select id="assign-fuel-type" value={fuelTypeFilter} onChange={(event) => setFuelTypeFilter(event.target.value)}>
                  <option value="">All fuel types</option>
                  {fuelTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
              </div>
              <button type="button" className="assign-filter-reset" onClick={() => { setVehicleSearch(''); setVehicleTypeFilter(''); setFuelTypeFilter(''); }} disabled={!vehicleSearch && !vehicleTypeFilter && !fuelTypeFilter}>Reset filters</button>
              <span className="assign-filter-result-count">Showing {filteredVehicles.length} of {data.vehicles.length} vehicles</span>
            </div>
            <div className="assign-table-wrap">
            <table className="assign-table">
              <thead><tr><th>Vehicle</th><th>Type</th><th>Fuel</th><th>Total seats</th><th>Selection</th></tr></thead>
              <tbody>
                {data.vehicles.length === 0 ? <tr><td colSpan="5" className="assign-table-empty">No available vehicles found.</td></tr> : filteredVehicles.length === 0 ? <tr><td colSpan="5" className="assign-table-empty">No vehicles match these filters. Try changing or resetting your filters.</td></tr> : filteredVehicles.map((vehicle) => {
                  const active = selectedVehicle === String(vehicle.id);
                  return <tr key={vehicle.id} className={active ? 'is-selected' : ''} onClick={() => { if (!unavailableRequest) { setSelectedVehicle(String(vehicle.id)); setResourceTab('driver'); } }} aria-selected={active}>
                    <td><div className="vehicle-name-stack"><strong>{vehicleDisplayName(vehicle)}</strong><small>{vehicle.plate_number}</small></div></td><td>{vehicle.vehicle_type || '—'}</td><td>{vehicle.fuel_type || '—'}</td><td>{vehicle.seat_capacity == null ? <span className="assign-capacity-unknown">Not recorded</span> : <>{vehicle.seat_capacity} total / {Number(vehicle.seat_capacity) - 1} passengers</>}</td><td><button type="button" className={`assign-row-select ${active ? 'is-selected' : ''}`} disabled={unavailableRequest} onClick={(event) => { event.stopPropagation(); setSelectedVehicle(String(vehicle.id)); setResourceTab('driver'); }}>{active ? 'Selected · Continue' : 'Select vehicle'}</button></td>
                  </tr>;
                })}
              </tbody>
            </table>
            </div>
          </div>
        ) : (
          <div className="assign-table-wrap" role="tabpanel">
            <div className="assign-table-context">{selectedVehicleInfo ? <>Selected vehicle: <strong>{vehicleDisplayName(selectedVehicleInfo)} · {selectedVehicleInfo.plate_number}</strong> · {selectedVehicleInfo.seat_capacity == null ? 'Seat capacity not recorded' : `${Number(selectedVehicleInfo.seat_capacity) - 1} passenger seats (driver seat reserved)`}</> : 'Select a vehicle first, then choose an available driver.'}</div>
            <table className="assign-table">
              <thead><tr><th>Driver name</th><th>Phone</th><th>Selection</th></tr></thead>
              <tbody>
                {data.drivers.length === 0 ? <tr><td colSpan="3" className="assign-table-empty">No available drivers found.</td></tr> : data.drivers.map((driver) => {
                  const active = selectedDriver === String(driver.id);
                  return <tr key={driver.id} className={active ? 'is-selected' : ''} onClick={() => { if (!unavailableRequest) setSelectedDriver(String(driver.id)); }} aria-selected={active}>
                    <td><strong>{driver.name}</strong></td><td>{driver.phone || 'No phone number on file'}</td><td><button type="button" className={`assign-row-select ${active ? 'is-selected' : ''}`} disabled={unavailableRequest} onClick={(event) => { event.stopPropagation(); setSelectedDriver(String(driver.id)); }}>{active ? 'Selected' : 'Select driver'}</button></td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedVehicleInfo && <section className="assign-card" style={{ marginTop: 16, padding: 18 }}><div className="assign-card-title"><div><h2>Estimated energy consumption</h2><p>Based on the planned distance and the selected vehicle's registered efficiency. Estimates exclude reserve, terrain, traffic, and driving-style variation.</p></div></div>{!hasPlannedDistance ? <p className="assign-table-context">Enter a planned distance in the trip request to calculate estimated consumption.</p> : selectedIsElectric ? (estimatedElectricKwh == null ? <p className="assign-table-context">Electric energy consumption is not recorded for this vehicle.</p> : <><div className="assign-table-context"><strong>Normal charging:</strong> approximately {estimatedElectricKwh.toLocaleString(undefined, { maximumFractionDigits: 2 })} kWh</div><div className="assign-table-context"><strong>Fast charging:</strong> approximately {estimatedElectricKwh.toLocaleString(undefined, { maximumFractionDigits: 2 })} kWh</div><p className="assign-table-context">These are the same estimated trip energy requirement. Charging speed and charging losses are not modeled, and no charging cost is calculated.</p></>) : <div className="assign-table-context"><strong>Fuel:</strong> {estimatedFuelLiters == null ? 'Fuel efficiency not recorded for this vehicle.' : `approximately ${estimatedFuelLiters.toLocaleString(undefined, { maximumFractionDigits: 2 })} L for ${plannedDistanceKm.toLocaleString()} km.`}</div>}</section>}

      {request.checkpoints?.length > 0 && <section className="assign-card assign-checkpoints"><div className="assign-card-title"><div><h2><GitFork size={17} /> Route checkpoints</h2><p>{request.checkpoints.length} intermediate stop{request.checkpoints.length === 1 ? '' : 's'}</p></div><Route size={18} /></div><ol>{request.checkpoints.map((stop) => <li key={stop.id || stop.sequenceOrder}><span>{stop.sequenceOrder}</span>{stop.location}</li>)}</ol></section>}

      <div className="assign-confirm-bar">
        <div className="assign-confirm-icon"><ShieldCheck size={23} /></div>
        <div className="assign-confirm-copy"><span>CURRENT SELECTION</span><strong>{selectedVehicleInfo && selectedDriverInfo ? `Selected: ${vehicleDisplayName(selectedVehicleInfo)} · ${selectedVehicleInfo.plate_number} & ${selectedDriverInfo.name}` : 'Select one vehicle and one driver to continue'}</strong></div>
        <button className="assign-button assign-button--ghost" onClick={() => navigate('/manager/queue')} disabled={saving}>Cancel</button>
        <button className="assign-button assign-button--primary" onClick={confirmAssignment} disabled={saving || unavailableRequest || !selectedVehicle || !selectedDriver}>{saving ? 'Confirming…' : 'Confirm Assignment & Notify'} {saving ? <LoaderCircle className="assign-spinner" size={16} /> : <ArrowRight size={17} />}</button>
      </div>
      <div className="assign-footnote"><Clock3 size={14} /> Assignment is saved to the dispatch record. Driver notifications are not configured in this version.</div>
    </div>
  );
}
