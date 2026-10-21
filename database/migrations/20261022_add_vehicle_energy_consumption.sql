-- Store separate efficiency metrics for combustion and electric vehicles, plus planned trip distance.
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS fuel_efficiency_km_per_l NUMERIC(8,2);
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS energy_consumption_kwh_per_100km NUMERIC(8,2);
ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS vehicles_fuel_efficiency_km_per_l_check;
ALTER TABLE vehicles ADD CONSTRAINT vehicles_fuel_efficiency_km_per_l_check CHECK (fuel_efficiency_km_per_l IS NULL OR fuel_efficiency_km_per_l > 0);
ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS vehicles_energy_consumption_kwh_per_100km_check;
ALTER TABLE vehicles ADD CONSTRAINT vehicles_energy_consumption_kwh_per_100km_check CHECK (energy_consumption_kwh_per_100km IS NULL OR energy_consumption_kwh_per_100km > 0);
ALTER TABLE trip_requests ADD COLUMN IF NOT EXISTS planned_distance_km NUMERIC(8,2);
ALTER TABLE trip_requests DROP CONSTRAINT IF EXISTS trip_requests_planned_distance_km_check;
ALTER TABLE trip_requests ADD CONSTRAINT trip_requests_planned_distance_km_check CHECK (planned_distance_km IS NULL OR planned_distance_km > 0);
