import { useEffect, useState } from 'react';
import { UsersRound, Phone } from 'lucide-react';
import { api } from '../../api/client.js';
import './driver.css';

export default function DriverDirectoryPage() {
  const [drivers, setDrivers] = useState([]);
  const [error, setError] = useState('');
  useEffect(() => { api('/driver/directory').then((data) => setDrivers(data.drivers || [])).catch((e) => setError(e.message)); }, []);
  return <div className="driver-page"><div className="driver-page-head"><div><span className="driver-eyebrow">DIRECTORY</span><h1>Drivers</h1><p>Contact information for active drivers</p></div></div>{error && <div className="driver-alert driver-alert--error">{error}</div>}<div className="driver-directory-grid">{drivers.map((driver) => <article className="driver-info-card" key={driver.id}><small>DRIVER</small><strong>{driver.name}</strong>{driver.phone ? <a href={`tel:${driver.phone}`}><Phone size={14}/>{driver.phone}</a> : <span>No phone recorded</span>}</article>)}</div>{!drivers.length && !error && <div className="driver-empty-card"><UsersRound size={28}/><p>No driver directory records found.</p></div>}</div>;
}
