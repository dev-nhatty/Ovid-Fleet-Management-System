import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { ROLE_HOME } from '../config/roles.js';
import LoadingScreen from './LoadingScreen.jsx';

// Used for "/" and for any URL that doesn't exist (including sidebar links
// whose pages aren't built yet): signed-in people go to their own home page,
// everyone else goes to the login page.
export default function RootRedirect() {
  const { user, status } = useAuth();

  if (status === 'loading') return <LoadingScreen />;

  const home = user && ROLE_HOME[user.role];
  return <Navigate to={home || '/login'} replace />;
}
