import { api } from './client.js';

export function listFuelLogs({ page = 1, pageSize = 8, q = '', vehicleId = 'all', fuelTypeId = 'all', period = '30days' } = {}) {
  const params = new URLSearchParams({ page, pageSize, q, vehicleId, fuelTypeId, period });
  return api(`/fuel-logs?${params}`);
}
