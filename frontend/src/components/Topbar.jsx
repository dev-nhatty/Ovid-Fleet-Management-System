import { Search } from 'lucide-react';

export default function Topbar({ crumb }) {
  return (
    <header className="topbar">
      <div className="muted">{crumb} /</div>
      <div className="topbar__right">
        <div className="search search--topbar">
          <Search size={15} />
          <input placeholder="Quick search..." />
          <kbd>⌘K</kbd>
        </div>
        <span className="status-pill"><i className="dot dot--green" /> System Operational</span>
      </div>
    </header>
  );
}
