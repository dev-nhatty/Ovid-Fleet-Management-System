import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { ROLE_HOME } from '../config/roles.js';
import LoadingScreen from './LoadingScreen.jsx';

// Wrap a group of routes:
//   <Route element={<ProtectedRoute allowedRoles={[ROLES.MANAGER]} />}> ...pages... </Route>
//
// Not signed in         -> /login
// Signed in, wrong role -> that person's own home page.
// This only decides what the browser shows. The backend's requireRole()
// is what actually protects the data.
export default function ProtectedRoute({ allowedRoles, higherOfficerOnly = false }) {
  const { user, status } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <LoadingScreen />;

  if (status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!allowedRoles.includes(user.role) || (higherOfficerOnly && user.isHigherOfficer !== true)) {
    const home = ROLE_HOME[user.role];
    if (!home) return <p role="alert">Your account doesn't have access to this application.</p>;
    return <Navigate to={home} replace />;
  }

  return <Outlet />;
}
