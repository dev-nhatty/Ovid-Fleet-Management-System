export function getVehicleName(vehicle = {}) {
  const parts = [vehicle.brand_name, vehicle.model_name, vehicle.model_year]
    .filter((value) => value !== null && value !== undefined && String(value).trim() !== '');
  return parts.length ? parts.join(' ') : (vehicle.vehicle_type || 'Vehicle');
}
