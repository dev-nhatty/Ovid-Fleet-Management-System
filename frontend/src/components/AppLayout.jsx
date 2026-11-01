import { Outlet, useLocation, NavLink } from 'react-router-dom';
import { CalendarDays, Route, UsersRound, UserRound, Truck, CircleCheck } from 'lucide-react';
import Sidebar from './Sidebar.jsx';
import Topbar from './Topbar.jsx';

const driverNavigation = [
  { label: 'Today', to: '/driver/today', icon: CalendarDays },
  { label: 'My Trips', to: '/driver/trips', icon: Route },
  { label: 'Drivers', to: '/driver/drivers', icon: UsersRound },
  { label: 'Account', to: '/driver/account', icon: UserRound },
];

export default function AppLayout() {
  const { pathname } = useLocation();
  const isDriver = pathname.startsWith('/driver');
  const crumb = pathname.startsWith('/admin') ? 'Administration' : isDriver ? 'Driver' : 'Dispatch';

  return (
    <div className={`shell${isDriver ? ' shell--driver' : ''}`}>
      {isDriver && (
        <header className="driver-mobile-header">
          <div className="driver-mobile-brand">
            <span className="driver-mobile-brand-mark"><Truck size={20} /></span>
            <strong>Ovid Holdings</strong>
          </div>
          <span className="driver-system-status"><i /> System Operational</span>
        </header>
      )}
      <Sidebar />
      <div className="shell__main">
        <Topbar crumb={crumb} />
        <main className={`page${isDriver ? ' page--driver' : ''}`}><Outlet /></main>
      </div>
      {isDriver && (
        <nav className="driver-bottom-nav" aria-label="Driver navigation">
          {driverNavigation.map(({ label, to, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `driver-bottom-nav__item${isActive ? ' is-active' : ''}`}>
              <Icon size={21} strokeWidth={2.1} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  );
}
