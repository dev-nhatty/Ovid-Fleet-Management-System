import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Route, RefreshCw } from 'lucide-react';
import { getMyDriverTrips } from '../../api/driver.api.js';
import './driver.css';

export default function DriverTripsPage() {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  async function load() { setLoading(true); setError(''); try { const data = await getMyDriverTrips(); setTrips(data.trips || []); } catch (e) { setError(e.message); } finally { setLoading(false); } }
  useEffect(() => { load(); }, []);
  return <div className="driver-page"><div className="driver-page-head"><div><span className="driver-eyebrow">DRIVER</span><h1>My Trips</h1><p>Your assigned and completed trip history</p></div><button className="driver-refresh" onClick={load} disabled={loading}><RefreshCw size={15}/> Refresh</button></div>
    {error && <div className="driver-alert driver-alert--error">{error}</div>}
    <div className="driver-history-list">{loading ? <p className="driver-empty">Loading trips…</p> : trips.length ? trips.map((trip) => <Link className="driver-history-card" key={trip.trip_id} to="/driver/today"><div><small>TRP-{String(trip.trip_id).padStart(4,'0')} · {new Date(trip.assigned_at).toLocaleDateString()}</small><strong>{trip.origin || 'Origin'} <span>→</span> {trip.destination || 'Destination'}</strong><p>{trip.plate_number} · {trip.trip_type}</p></div><span className={`driver-status-pill ${trip.status === 'In Progress' ? 'is-progress' : trip.status === 'Assigned' ? 'is-assigned' : 'is-complete'}`}>{trip.status}</span></Link>) : <div className="driver-empty-card"><Route size={28}/><h2>No trips recorded</h2><p>Your trip history will appear here.</p></div>}</div>
  </div>;
}
