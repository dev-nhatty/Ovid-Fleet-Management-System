import { useCallback, useEffect, useMemo, useState } from 'react';
import { Fuel, Truck, Hash, LockKeyhole, CheckCircle2, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createFuelTransaction, getRecordFuelOptions } from '../../api/recordFuel.api.js';
import { getVehicleName } from '../../utils/vehicleDisplay.js';
import './record-fuel.css';

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};
const money = (n) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const vehicleLabel = (vehicle) => vehicle
  ? `${getVehicleName(vehicle)} • ${vehicle.plate_number || 'No plate'}`
  : '';

export default function RecordFuelPage() {
  const navigate = useNavigate();
  const [options, setOptions] = useState({ vehicles: [], fuelTypes: [] });
  const [form, setForm] = useState({ vehicleId: '', fuelTypeId: '', fueledDate: today(), liters: '', pricePerLiter: '' });
  const [vehicleQuery, setVehicleQuery] = useState('');
  const [vehiclePickerOpen, setVehiclePickerOpen] = useState(false);
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false);
  const [error, setError] = useState(''), [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const data = await getRecordFuelOptions();
      const vehicles = data.vehicles || [];
      setOptions({ vehicles, fuelTypes: data.fuelTypes || [] });
      setVehicleQuery(vehicleLabel(vehicles[0]));
      setForm(old => ({ ...old, vehicleId: old.vehicleId || String(vehicles[0]?.id || ''), fuelTypeId: old.fuelTypeId || String(data.fuelTypes?.[0]?.id || '') }));
    } catch (e) { setError(e.message || 'Could not load vehicles and fuel types.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const total = useMemo(() => {
    const liters = Number(form.liters), price = Number(form.pricePerLiter);
    return form.liters !== '' && form.pricePerLiter !== '' && liters > 0 && price >= 0 ? liters * price : 0;
  }, [form.liters, form.pricePerLiter]);
  const selected = options.vehicles.find(v => String(v.id) === form.vehicleId);
  const filteredVehicles = useMemo(() => {
    const query = vehicleQuery.trim().toLowerCase();
    if (!query) return options.vehicles;
    return options.vehicles.filter(vehicle => [
      vehicleLabel(vehicle),
      vehicle.plate_number,
      vehicle.brand_name,
      vehicle.model_name,
      vehicle.model_year,
      vehicle.vehicle_type,
      vehicle.fuel_type
    ].filter(value => value !== null && value !== undefined).join(' ').toLowerCase().includes(query));
  }, [options.vehicles, vehicleQuery]);
  const chooseVehicle = (vehicle) => {
    setForm(old => ({ ...old, vehicleId: String(vehicle.id) }));
    setVehicleQuery(vehicleLabel(vehicle));
    setVehiclePickerOpen(false);
    setError('');
    setSuccess('');
  };
  const update = (key, value) => { setForm(old => ({ ...old, [key]: value })); setSuccess(''); };

  async function submit(e) {
    e.preventDefault(); setError(''); setSuccess('');
    if (!form.vehicleId || !form.fuelTypeId || !form.fueledDate || form.liters === '' || form.pricePerLiter === '') {
      setError('Complete all required fields before recording fuel.'); return;
    }
    if (Number(form.liters) <= 0 || Number(form.pricePerLiter) < 0) {
      setError('Quantity must be greater than zero and price cannot be negative.'); return;
    }
    setSaving(true);
    try {
      const result = await createFuelTransaction({ vehicleId: Number(form.vehicleId), fuelTypeId: Number(form.fuelTypeId), fueledDate: form.fueledDate, liters: Number(form.liters), pricePerLiter: Number(form.pricePerLiter) });
      setSuccess(`Fuel transaction ${result.transaction.transaction_ref} recorded successfully.`);
      setForm(old => ({ ...old, liters: '', pricePerLiter: '' }));
    } catch (err) { setError(err.message || 'Could not record this fuel transaction.'); }
    finally { setSaving(false); }
  }
  function clearForm() {
    const firstVehicle = options.vehicles[0];
    setForm({ vehicleId: String(firstVehicle?.id || ''), fuelTypeId: String(options.fuelTypes[0]?.id || ''), fueledDate: today(), liters: '', pricePerLiter: '' });
    setVehicleQuery(vehicleLabel(firstVehicle));
    setVehiclePickerOpen(false);
    setError(''); setSuccess('');
  }

  return <main className="record-fuel-page">
    <form className="record-fuel-card" onSubmit={submit}>
      <header className="record-fuel-heading"><h1>Record Fuel</h1><p>Enter fuel intake details for registered fleet vehicles.</p></header>
      {error && <div className="record-fuel-alert" role="alert"><AlertCircle size={17}/>{error}</div>}
      {success && <div className="record-fuel-success" role="status"><CheckCircle2 size={17}/><span>{success}</span><button type="button" onClick={() => navigate('/manager/fuel-logs')}>View fuel logs</button></div>}
      <div className="record-fuel-field record-fuel-vehicle-picker">
        <label htmlFor="rf-vehicle">Vehicle <b>*</b></label>
        <div className={`record-fuel-vehicle-combobox${vehiclePickerOpen ? ' is-open' : ''}`}>
          <Truck size={19} aria-hidden="true" />
          <input
            id="rf-vehicle"
            type="text"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={vehiclePickerOpen}
            aria-controls="rf-vehicle-options"
            aria-required="true"
            autoComplete="off"
            placeholder={loading ? 'Loading vehicles…' : 'Search by plate, brand, model or year'}
            value={vehicleQuery}
            disabled={loading || !options.vehicles.length}
            onFocus={() => setVehiclePickerOpen(true)}
            onChange={e => {
              setVehicleQuery(e.target.value);
              setVehiclePickerOpen(true);
              setForm(old => ({ ...old, vehicleId: '' }));
              setError('');
              setSuccess('');
            }}
            onKeyDown={e => {
              if (e.key === 'Escape') setVehiclePickerOpen(false);
              if (e.key === 'Enter' && vehiclePickerOpen && filteredVehicles.length) {
                e.preventDefault();
                chooseVehicle(filteredVehicles[0]);
              }
            }}
            required={!form.vehicleId}
          />
          <button type="button" className="record-fuel-vehicle-toggle" aria-label={vehiclePickerOpen ? 'Close vehicle suggestions' : 'Show vehicle suggestions'} onClick={() => setVehiclePickerOpen(open => !open)} disabled={loading || !options.vehicles.length}>▾</button>
          {vehiclePickerOpen && <div className="record-fuel-vehicle-options" id="rf-vehicle-options" role="listbox">
            {filteredVehicles.length ? filteredVehicles.map(vehicle => (
              <button
                type="button"
                role="option"
                aria-selected={String(vehicle.id) === form.vehicleId}
                className={`record-fuel-vehicle-option${String(vehicle.id) === form.vehicleId ? ' is-selected' : ''}`}
                key={vehicle.id}
                onClick={() => chooseVehicle(vehicle)}
              >
                <span className="record-fuel-vehicle-option-name">{getVehicleName(vehicle)}</span>
                <span className="record-fuel-vehicle-option-meta">{vehicle.plate_number || 'No plate'}{vehicle.vehicle_type ? ` · ${vehicle.vehicle_type}` : ''}</span>
              </button>
            )) : <div className="record-fuel-vehicle-empty">{loading ? 'Loading vehicles…' : 'No matching vehicles found'}</div>}
          </div>}
        </div>
        {!options.vehicles.length && !loading && <small className="record-fuel-vehicle-help">No active vehicles are available.</small>}
      </div>
      <div className="record-fuel-grid">
        <div className="record-fuel-field"><label htmlFor="rf-type">Fuel Type <b>*</b></label><select id="rf-type" value={form.fuelTypeId} onChange={e => update('fuelTypeId',e.target.value)} required disabled={loading || !options.fuelTypes.length}>
          {!options.fuelTypes.length && <option value="">No fuel types available</option>}
          {options.fuelTypes.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select></div>
        <div className="record-fuel-field"><label htmlFor="rf-date">Fueling Date <b>*</b></label><input id="rf-date" type="date" max={today()} value={form.fueledDate} onChange={e => update('fueledDate',e.target.value)} required/></div>
        <div className="record-fuel-field"><label htmlFor="rf-liters">Quantity (Liters) <b>*</b></label><input id="rf-liters" type="number" min="0.01" step="0.01" placeholder="e.g. 45.50" value={form.liters} onChange={e => update('liters',e.target.value)} required/></div>
        <div className="record-fuel-field"><label htmlFor="rf-price">Price per Liter <b>*</b></label><input id="rf-price" type="number" min="0" step="0.01" placeholder="e.g. 120.00" value={form.pricePerLiter} onChange={e => update('pricePerLiter',e.target.value)} required/></div>
      </div>
      <section className="record-fuel-total"><span>Estimated Total Cost</span><strong>{money(total)}</strong><small>{money(Number(form.liters)||0)} liters × {money(Number(form.pricePerLiter)||0)} per liter</small></section>
      <div className="record-fuel-field record-fuel-reference">
        <div className="record-fuel-reference-label"><label>Transaction Reference</label><span><LockKeyhole size={13}/> Auto-generated</span></div>
        <div className="record-fuel-reference-value"><Hash size={17}/><code>FUEL-{form.fueledDate.slice(0,4) || new Date().getFullYear()}-AUTO</code></div>
        <small>System-generated unique identifier for this fuel transaction.</small>
      </div>
      {selected && <p className="record-fuel-selected">Selected vehicle: {getVehicleName(selected)} · {selected.plate_number}</p>}
      <footer className="record-fuel-actions"><button type="button" className="record-fuel-clear" onClick={clearForm} disabled={saving}>Clear Form</button><button type="submit" className="record-fuel-submit" disabled={saving || loading || !options.vehicles.length || !options.fuelTypes.length}><Fuel size={16}/>{saving ? 'Recording...' : 'Record Fuel'}</button></footer>
    </form>
  </main>;
}
