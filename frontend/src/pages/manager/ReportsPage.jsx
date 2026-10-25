import { useNavigate } from 'react-router-dom';
import { RefreshCw, UserRoundCog, ContactRound, Truck, Fuel, ChevronRight, Activity } from 'lucide-react';
import './reports-page.css';

const REPORT_GROUPS = [
  {
    title: 'User reports', description: 'Accounts, roles and access status', count: 'User accounts', icon: UserRoundCog, reports: [
      { key: 'user-directory', title: 'User directory', description: 'All accounts with role, username, phone and status' },
      { key: 'accounts-by-role', title: 'Accounts by role and status', description: 'Active and inactive accounts, grouped by role' },
    ]
  },
  {
    title: 'Driver reports', description: 'Drivers and their trip activity', count: 'Driver activity', icon: ContactRound, reports: [
      { key: 'driver-directory', title: 'Driver directory', description: 'Drivers with phone number and current availability' },
      { key: 'driver-trip-summary', title: 'Driver trip summary', description: 'Completed and cancelled trips and distance per driver' },
      { key: 'driver-trip-history', title: 'Driver trip history', description: 'Every trip for a selected driver' },
    ]
  },
  {
    title: 'Vehicle reports', description: 'The fleet, its use and upkeep', count: 'Fleet records', icon: Truck, reports: [
      { key: 'fleet-register', title: 'Fleet register', description: 'Every vehicle with plate, type, fuel type, seats and status' },
      { key: 'vehicle-utilization', title: 'Vehicle utilization', description: 'Trips and distance covered per vehicle' },
      { key: 'maintenance-cost', title: 'Maintenance cost', description: 'Service, repair and inspection costs per vehicle' },
    ]
  },
  {
    title: 'Fuel reports', description: 'Consumption and spend', count: 'Fuel & energy', icon: Fuel, reports: [
      { key: 'fuel-consumption', title: 'Fuel consumption by vehicle', description: 'Litres and kWh recorded for each vehicle' },
      { key: 'fuel-cost-summary', title: 'Fuel cost summary', description: 'Total spend by period, vehicle and fuel type' },
      { key: 'expected-vs-actual', title: 'Expected vs actual consumption', description: 'Rated efficiency compared with recorded fuel' },
    ]
  },
];

function ReportCategory({ group, onSelect }) {
  const Icon = group.icon;
  return <article className="reports-category">
    <header className="reports-category__header">
      <span className="reports-category__icon"><Icon size={22} strokeWidth={1.8} /></span>
      <div className="reports-category__titles"><h2>{group.title}</h2><p>{group.description}</p></div>
      <span className="reports-category__count">{group.count}</span>
    </header>
    <div className="reports-category__items">
      {group.reports.map((report) => <button className="reports-item" key={report.key} type="button" onClick={() => onSelect(report.key)}>
        <span className="reports-item__copy"><strong>{report.title}</strong><span>{report.description}</span></span><ChevronRight size={18} aria-hidden="true" />
      </button>)}
    </div>
  </article>;
}

export default function ReportsPage() {
  const navigate = useNavigate();
  return <section className="reports-page">
    <div className="reports-page__heading"><div><div className="reports-page__eyebrow">MANAGEMENT <span>·</span> <strong>4 REPORT CATEGORIES</strong></div><h1>Reports</h1><p>Choose a report to set its date range and generate it.</p></div>
      <button className="reports-refresh" type="button" onClick={() => window.location.reload()}><RefreshCw size={16} /> Refresh</button>
    </div>
    <div className="reports-grid">{REPORT_GROUPS.map((group) => <ReportCategory key={group.title} group={group} onSelect={(key) => navigate(`/manager/reports/${key}`)} />)}</div>
    <footer className="reports-page__footer"><Activity size={15} /><span>Reports are generated from live fleet records.</span></footer>
  </section>;
}
