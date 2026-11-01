import { useAuth } from '../../context/AuthContext.jsx';
import './driver.css';
export default function DriverAccountPage() {
  const { user } = useAuth();
  return <div className="driver-page"><div className="driver-page-head"><div><span className="driver-eyebrow">ACCOUNT</span><h1>Account</h1><p>Your driver account information</p></div></div><section className="driver-account-card"><span className="driver-account-avatar">{(user.name || 'D').split(' ').map((part) => part[0]).slice(0,2).join('')}</span><div><strong>{user.name}</strong><p>Driver</p><small>Account ID: {user.id}</small></div></section></div>;
}
