import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import Topbar from './Topbar.jsx';

export default function AppLayout() {
  const { pathname } = useLocation();
  const crumb = pathname.startsWith('/admin') ? 'Administration' : 'Dispatch';

  return (
    <div className="shell">
      <Sidebar />
      <div className="shell__main">
        <Topbar crumb={crumb} />
        <main className="page"><Outlet /></main>
      </div>
    </div>
  );
}
