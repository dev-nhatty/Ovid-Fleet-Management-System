-- Adds per-vehicle fuel efficiency and the planned distance captured with a trip request.
-- Existing records remain NULL until updated; new trip requests collect planned distance in the UI.
ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS fuel_efficiency_km_per_l NUMERIC(8,2);

ALTER TABLE vehicles
  DROP CONSTRAINT IF EXISTS vehicles_fuel_efficiency_km_per_l_check;
ALTER TABLE vehicles
  ADD CONSTRAINT vehicles_fuel_efficiency_km_per_l_check
  CHECK (fuel_efficiency_km_per_l IS NULL OR fuel_efficiency_km_per_l > 0);

ALTER TABLE trip_requests
  ADD COLUMN IF NOT EXISTS planned_distance_km NUMERIC(8,2);

ALTER TABLE trip_requests
  DROP CONSTRAINT IF EXISTS trip_requests_planned_distance_km_check;
ALTER TABLE trip_requests
  ADD CONSTRAINT trip_requests_planned_distance_km_check
  CHECK (planned_distance_km IS NULL OR planned_distance_km > 0);
