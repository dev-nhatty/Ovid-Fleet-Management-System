import { api } from './client.js';
export const listAdminVehicles = () => api('/admin/vehicles');
export const getAdminVehicleOptions = () => api('/admin/vehicles/options');
export const getAdminVehicle = (id) => api(`/admin/vehicles/${encodeURIComponent(id)}`);
export const createAdminVehicle = (body) => api('/admin/vehicles', { method: 'POST', body });
export const updateAdminVehicle = (id, body) => api(`/admin/vehicles/${encodeURIComponent(id)}`, { method: 'PATCH', body });
export const updateAdminVehicleStatus = (id, status) => api(`/admin/vehicles/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: { status } });
