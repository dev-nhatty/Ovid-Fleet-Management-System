import { LayoutDashboard, Inbox, PlusCircle, Truck, IdCard, Route, History, Fuel, UserCog, Building2, Users } from 'lucide-react';
import { ROLES } from '../config/roles.js';

export const NAV = {
  [ROLES.MANAGER]: [
    { title: 'Dispatch', items: [
      { label: 'Dashboard', to: '/manager/dashboard', icon: LayoutDashboard },
      { label: 'Queue', to: '/manager/queue', icon: Inbox },
      { label: 'New Request', to: '/manager/new-request', icon: PlusCircle },
      { label: 'Assign Trip', to: '/manager/assign-trip', icon: Inbox },
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
      { label: 'Dashboard', to: '/admin/dashboard', icon: LayoutDashboard },
      { label: 'Users', to: '/admin/users', icon: UserCog },
    ]},
    { title: 'Master Data', items: [
      { label: 'Departments', to: '/admin/departments', icon: Building2 },
      { label: 'Employees', to: '/admin/employees', icon: Users },
      { label: 'Vehicles', to: '/admin/vehicles', icon: Truck },
    ]},
  ],
};
