import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { homePathFor } from '../utils/roles';

// `allow(user)` decides access. Unauthenticated users go to /login; wrong role goes to their own home.
export default function ProtectedRoute({ allow }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (allow && !allow(user)) return <Navigate to={homePathFor(user)} replace />;
  return <Outlet />;
}
