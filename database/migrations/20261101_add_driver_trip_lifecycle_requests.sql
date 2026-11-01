-- Driver actions are requests only. Officers remain the only role that
-- changes trips.status to In Progress or Completed.
ALTER TABLE trips
  ADD COLUMN IF NOT EXISTS driver_start_requested_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS driver_finish_requested_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_trips_driver_id_status
  ON trips(driver_id, status);
