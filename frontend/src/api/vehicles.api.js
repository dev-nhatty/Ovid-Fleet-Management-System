import { api } from './client.js';

export function listVehicles() {
  return api('/vehicles');
}

export function getVehicleDetails(vehicleId) {
  return api(`/vehicles/${encodeURIComponent(vehicleId)}`);
}
