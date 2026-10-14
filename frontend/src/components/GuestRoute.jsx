import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { ROLE_HOME } from '../config/roles.js';
import LoadingScreen from './LoadingScreen.jsx';

// For /login. Someone who is already signed in is sent straight to their
// own home page instead of seeing the form again.
export default function GuestRoute() {
  const { user, status } = useAuth();

  if (status === 'loading') return <LoadingScreen />;

  const home = user && ROLE_HOME[user.role];
  if (home) return <Navigate to={home} replace />;

  return <Outlet />;
}
