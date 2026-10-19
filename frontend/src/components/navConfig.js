import {
  Inbox, PlusCircle, Truck, IdCard, Route, GitFork, History, Fuel,
  UserCog, Building2, Users, Tag, FlaskConical, Map, Clock, FileText,
} from 'lucide-react';
import { ROLES } from '../config/roles.js';

// Sidebar sections per role, keyed by the exact role string from the database.
// Each role sees only its own list. The signed-in person's name and role
// label come from AuthContext (see Sidebar.jsx), not from here.
// Pages that aren't built yet send people back to their home page.
export const NAV = {
  [ROLES.MANAGER]: [
    { title: 'Dispatch', items: [
      { label: 'Requests', to: '/manager/queue', icon: Inbox },
      { label: 'New Request', to: '/manager/new-request', icon: PlusCircle },
      { label: 'Assign Trip', to: '/manager/assign-trip', icon: GitFork },
      { label: 'Vehicles', to: '/manager/vehicles', icon: Truck },
      { label: 'Drivers', to: '/manager/drivers', icon: IdCard },
    ]},
    { title: 'Operations', items: [
      { label: 'Trip Detail', to: '/manager/trips', icon: Route },
      { label: 'Fuel Logs', to: '/manager/fuel-logs', icon: History },
      { label: 'Record Fuel', to: '/manager/record-fuel', icon: Fuel },
    ]},
  ],
  [ROLES.ADMIN]: [
    { title: 'Administration', items: [
      { label: 'Users', to: '/admin/users', icon: UserCog },
    ]},
    { title: 'Master Data', items: [
      { label: 'Departments', to: '/admin/departments', icon: Building2 },
      { label: 'Employees', to: '/admin/employees', icon: Users },
      { label: 'Vehicles', to: '/admin/vehicles', icon: Truck },
      { label: 'Vehicle Types', to: '/admin/vehicle-types', icon: Tag },
      { label: 'Fuel Types', to: '/admin/fuel-types', icon: FlaskConical },
    ]},
    { title: 'Oversight', items: [
      { label: 'Trips', to: '/admin/trips', icon: Map },
      { label: 'Fuel Logs', to: '/admin/fuel-logs', icon: Clock },
      { label: 'Reports', to: '/admin/reports', icon: FileText },
    ]},
  ],
};