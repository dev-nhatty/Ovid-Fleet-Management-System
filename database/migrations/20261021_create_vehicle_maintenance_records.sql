-- Create the read-only maintenance history data source shown on Vehicle Details.
-- Maintenance record creation/management will be implemented in the dedicated
-- supervisor/official maintenance workflow later.
CREATE TABLE IF NOT EXISTS vehicle_maintenance_records (
    id                      SERIAL PRIMARY KEY,
    vehicle_id              INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    maintenance_type        VARCHAR(40) NOT NULL
                                CHECK (maintenance_type IN ('Routine Service', 'Repair', 'Inspection')),
    cost                    NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (cost >= 0),
    status                  VARCHAR(20) NOT NULL DEFAULT 'Completed'
                                CHECK (status IN ('Scheduled', 'In Progress', 'Completed', 'Cancelled')),
    maintenance_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    recorded_by_user_id     INTEGER NOT NULL REFERENCES users(id),
    recorded_at             TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vehicle_maintenance_vehicle_time
    ON vehicle_maintenance_records(vehicle_id, maintenance_at DESC);
