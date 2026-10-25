import { Routes, Route } from 'react-router-dom';
import LoginPage from './pages/LoginPage.jsx';
import AppLayout from './components/AppLayout.jsx';
import GuestRoute from './components/GuestRoute.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import RootRedirect from './components/RootRedirect.jsx';
import DispatchQueuePage from './pages/manager/DispatchQueuePage.jsx';
import DashboardPage from './pages/manager/DashboardPage.jsx';
import NewRequestPage from './pages/manager/NewRequestPage.jsx';
import AssignTripPage from './pages/manager/AssignTripPage.jsx';
import VehiclesPage from './pages/manager/VehiclesPage.jsx';
import VehicleDetailsPage from './pages/manager/VehicleDetailsPage.jsx';
import DriversPage from './pages/manager/DriversPage.jsx';
import DriverDetailsPage from './pages/manager/DriverDetailsPage.jsx';
import TripsPage from './pages/manager/TripsPage.jsx';
import TripDetailPage from './pages/manager/TripDetailPage.jsx';
import FuelLogsPage from './pages/manager/FuelLogsPage.jsx';
import RecordFuelPage from './pages/manager/RecordFuelPage.jsx';
import UsersPage from './pages/admin/UsersPage.jsx';
import NewUserPage from './pages/admin/NewUserPage.jsx';
import DepartmentsPage from './pages/admin/DepartmentsPage.jsx';
import AdminVehiclesPage from './pages/admin/VehiclesPage.jsx';
import AdminDashboardPage from './pages/admin/AdminDashboardPage.jsx';
import ReportsPage from './pages/manager/ReportsPage.jsx';
import ReportDetailPage from './pages/manager/ReportDetailPage.jsx';
import { ROLES } from './config/roles.js';

export default function App() {
  return (
    <Routes>
      <Route element={<GuestRoute />}>
        <Route path="/login" element={<LoginPage />} />
      </Route>

      {/* Manager (shown as "Officer") pages */}
      <Route element={<ProtectedRoute allowedRoles={[ROLES.MANAGER]} />}>
        <Route element={<AppLayout />}>
          <Route path="/manager/dashboard" element={<DashboardPage />} />
          <Route path="/manager/queue" element={<DispatchQueuePage />} />
          <Route path="/manager/new-request" element={<NewRequestPage />} />
          <Route path="/manager/assign-trip" element={<AssignTripPage />} />
          <Route path="/manager/assign-trip/:requestId" element={<AssignTripPage />} />
          <Route path="/manager/vehicles" element={<VehiclesPage />} />
          <Route path="/manager/vehicles/:vehicleId" element={<VehicleDetailsPage />} />
          <Route path="/manager/drivers" element={<DriversPage />} />
          <Route path="/manager/drivers/:driverId" element={<DriverDetailsPage />} />
          <Route path="/manager/trips" element={<TripsPage />} />
          <Route path="/manager/trips/:tripId" element={<TripDetailPage />} />
          <Route path="/manager/fuel-logs" element={<FuelLogsPage />} />
          <Route path="/manager/record-fuel" element={<RecordFuelPage />} />
          <Route element={<ProtectedRoute allowedRoles={[ROLES.MANAGER]} higherOfficerOnly />}>
            <Route path="/manager/reports" element={<ReportsPage />} />
            <Route path="/manager/reports/:reportKey" element={<ReportDetailPage />} />
          </Route>
        </Route>
      </Route>

      {/* System Administrator pages */}
      <Route element={<ProtectedRoute allowedRoles={[ROLES.ADMIN]} />}>
        <Route element={<AppLayout />}>
          <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
          <Route path="/admin/users" element={<UsersPage />} />
          <Route path="/admin/users/new" element={<NewUserPage />} />
          <Route path="/admin/departments" element={<DepartmentsPage />} />
          <Route path="/admin/vehicles" element={<AdminVehiclesPage />} />
        </Route>
      </Route>

      <Route path="*" element={<RootRedirect />} />
    </Routes>
  );
}