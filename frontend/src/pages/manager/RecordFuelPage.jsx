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
  const [form, setForm] = useState({ vehicleId: '', fuelTypeId: '', fueledDate: today(), liters: '', pricePerLiter: '', kwh: '', pricePerKwh: '' });
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

  const selectedFuelType = options.fuelTypes.find(f => String(f.id) === form.fuelTypeId);
  const isElectric = /electric/i.test(selectedFuelType?.name || '');
  const total = useMemo(() => {
    const quantity = Number(isElectric ? form.kwh : form.liters);
    const price = Number(isElectric ? form.pricePerKwh : form.pricePerLiter);
    const quantityText = isElectric ? form.kwh : form.liters;
    const priceText = isElectric ? form.pricePerKwh : form.pricePerLiter;
    return quantityText !== '' && priceText !== '' && quantity > 0 && price >= 0 ? quantity * price : 0;
  }, [form.liters, form.pricePerLiter, form.kwh, form.pricePerKwh, isElectric]);
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
    const quantityText = isElectric ? form.kwh : form.liters;
    const priceText = isElectric ? form.pricePerKwh : form.pricePerLiter;
    if (!form.vehicleId || !form.fuelTypeId || !form.fueledDate || quantityText === '' || priceText === '') {
      setError('Complete all required fields before recording this transaction.'); return;
    }
    if (Number(quantityText) <= 0 || Number(priceText) < 0) {
      setError(isElectric ? 'Energy must be greater than zero and price per kWh cannot be negative.' : 'Quantity must be greater than zero and price per liter cannot be negative.'); return;
    }
    setSaving(true);
    try {
      const payload = { vehicleId: Number(form.vehicleId), fuelTypeId: Number(form.fuelTypeId), fueledDate: form.fueledDate, ...(isElectric ? { kwh: Number(form.kwh), pricePerKwh: Number(form.pricePerKwh) } : { liters: Number(form.liters), pricePerLiter: Number(form.pricePerLiter) }) };
      const result = await createFuelTransaction(payload);
      setSuccess(`${isElectric ? 'Charging' : 'Fuel'} transaction ${result.transaction.transaction_ref} recorded successfully.`);
      setForm(old => ({ ...old, liters: '', pricePerLiter: '', kwh: '', pricePerKwh: '' }));
    } catch (err) { setError(err.message || 'Could not record this fuel transaction.'); }
    finally { setSaving(false); }
  }
  function clearForm() {
    const firstVehicle = options.vehicles[0];
    setForm({ vehicleId: String(firstVehicle?.id || ''), fuelTypeId: String(options.fuelTypes[0]?.id || ''), fueledDate: today(), liters: '', pricePerLiter: '', kwh: '', pricePerKwh: '' });
    setVehicleQuery(vehicleLabel(firstVehicle));
    setVehiclePickerOpen(false);
    setError(''); setSuccess('');
  }

  return <main className="record-fuel-page">
    <form className="record-fuel-card" onSubmit={submit}>
      <header className="record-fuel-heading"><h1>{isElectric ? 'Record Charging' : 'Record Fuel'}</h1><p>{isElectric ? 'Enter electricity consumed and charging cost for a registered electric vehicle.' : 'Enter fuel intake details for registered fleet vehicles.'}</p></header>
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
        <div className="record-fuel-field"><label htmlFor="rf-type">{isElectric ? 'Energy Type' : 'Fuel Type'} <b>*</b></label><select id="rf-type" value={form.fuelTypeId} onChange={e => { update('fuelTypeId',e.target.value); setForm(old => ({ ...old, fuelTypeId: e.target.value, liters: '', pricePerLiter: '', kwh: '', pricePerKwh: '' })); }} required disabled={loading || !options.fuelTypes.length}>
          {!options.fuelTypes.length && <option value="">No fuel types available</option>}
          {options.fuelTypes.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select></div>
        <div className="record-fuel-field"><label htmlFor="rf-date">Fueling Date <b>*</b></label><input id="rf-date" type="date" max={today()} value={form.fueledDate} onChange={e => update('fueledDate',e.target.value)} required/></div>
        {isElectric ? <>
          <div className="record-fuel-field"><label htmlFor="rf-kwh">Energy Charged (kWh) <b>*</b></label><input id="rf-kwh" type="number" min="0.01" step="0.01" placeholder="e.g. 42.50" value={form.kwh} onChange={e => update('kwh',e.target.value)} required/></div>
          <div className="record-fuel-field"><label htmlFor="rf-price-kwh">Price per kWh (ETB) <b>*</b></label><input id="rf-price-kwh" type="number" min="0" step="0.01" placeholder="e.g. 8.50" value={form.pricePerKwh} onChange={e => update('pricePerKwh',e.target.value)} required/></div>
        </> : <>
          <div className="record-fuel-field"><label htmlFor="rf-liters">Quantity (Liters) <b>*</b></label><input id="rf-liters" type="number" min="0.01" step="0.01" placeholder="e.g. 45.50" value={form.liters} onChange={e => update('liters',e.target.value)} required/></div>
          <div className="record-fuel-field"><label htmlFor="rf-price">Price per Liter (ETB) <b>*</b></label><input id="rf-price" type="number" min="0" step="0.01" placeholder="e.g. 120.00" value={form.pricePerLiter} onChange={e => update('pricePerLiter',e.target.value)} required/></div>
        </>}
      </div>
      <section className="record-fuel-total"><span>Estimated Total {isElectric ? 'Charging Cost' : 'Fuel Cost'}</span><strong>{money(total)} ETB</strong><small>{isElectric ? `${money(Number(form.kwh)||0)} kWh × ${money(Number(form.pricePerKwh)||0)} per kWh` : `${money(Number(form.liters)||0)} liters × ${money(Number(form.pricePerLiter)||0)} per liter`}</small></section>
      <div className="record-fuel-field record-fuel-reference">
        <div className="record-fuel-reference-label"><label>Transaction Reference</label><span><LockKeyhole size={13}/> Auto-generated</span></div>
        <div className="record-fuel-reference-value"><Hash size={17}/><code>{isElectric ? 'CHG' : 'FUEL'}-{form.fueledDate.slice(0,4) || new Date().getFullYear()}-AUTO</code></div>
        <small>System-generated unique identifier for this {isElectric ? 'charging' : 'fuel'} transaction.</small>
      </div>
      {selected && <p className="record-fuel-selected">Selected vehicle: {getVehicleName(selected)} · {selected.plate_number}</p>}
      <footer className="record-fuel-actions"><button type="button" className="record-fuel-clear" onClick={clearForm} disabled={saving}>Clear Form</button><button type="submit" className="record-fuel-submit" disabled={saving || loading || !options.vehicles.length || !options.fuelTypes.length}><Fuel size={16}/>{saving ? 'Recording...' : isElectric ? 'Record Charging' : 'Record Fuel'}</button></footer>
    </form>
  </main>;
}
