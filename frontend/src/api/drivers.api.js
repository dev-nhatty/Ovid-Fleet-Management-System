import { api } from './client.js';

export function listDrivers() {
  return api('/drivers');
}

export function getDriverDetails(driverId) {
  return api(`/drivers/${encodeURIComponent(driverId)}`);
}
