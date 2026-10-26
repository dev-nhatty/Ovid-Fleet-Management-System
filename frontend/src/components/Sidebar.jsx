import { NavLink } from 'react-router-dom';
import { Truck, ChevronsUpDown, LogOut, ChartNoAxesColumn, UserPlus } from 'lucide-react';
import { NAV } from './navConfig.js';
import { useAuth } from '../context/AuthContext.jsx';
import { ROLE_LABELS } from '../config/roles.js';

export default function Sidebar() {
  const { user, signOut } = useAuth();
  const baseSections = NAV[user.role] ?? [];
  const sections = user.role === 'Manager' && user.isHigherOfficer
    ? [...baseSections, {
      title: 'Management', items: [
        { label: 'Reports', to: '/manager/reports', icon: ChartNoAxesColumn },
        { label: 'Officers', to: '/manager/officers', icon: UserPlus },
      ]
    }]
    : baseSections;
  const initials = user.name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('');

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <span className="brand-mark"><Truck size={16} /></span>
        <span className="brand-name">Ovid Holdings</span>
        <ChevronsUpDown size={14} className="muted" />
      </div>

      <nav className="sidebar__nav">
        {sections.map((s) => (
          <div key={s.title} className="nav-section">
            <div className="nav-section__title">{s.title}</div>
            {s.items.map(({ label, to, icon: Icon }) => (
              <NavLink key={to} to={to}
                className={({ isActive }) => 'nav-item' + (isActive ? ' nav-item--active' : '')}>
                <Icon size={16} /> {label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar__user">
        <span className="avatar">{initials}</span>
        <div className="sidebar__user-text">
          <div className="strong">{user.name}</div>
          <div className="muted small">{user.role === 'Manager' && user.isHigherOfficer ? 'Higher Officer' : (ROLE_LABELS[user.role] ?? user.role)}</div>
        </div>
        <button className="icon-btn" aria-label="Sign out" onClick={signOut}><LogOut size={16} /></button>
      </div>
    </aside>
  );
}
