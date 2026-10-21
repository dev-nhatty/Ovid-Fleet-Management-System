CREATE TABLE vehicle_types (
    id      SERIAL PRIMARY KEY,
    name    VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE fuel_types (
    id      SERIAL PRIMARY KEY,
    name    VARCHAR(30) NOT NULL UNIQUE
);

CREATE TABLE departments (
    id      SERIAL PRIMARY KEY,
    name    VARCHAR(100) NOT NULL,
    status  VARCHAR(20) NOT NULL DEFAULT 'Active'
                CHECK (status IN ('Active', 'Inactive'))
);

CREATE TABLE employees (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(150) NOT NULL,
    phone           VARCHAR(30),
    department_id   INTEGER REFERENCES departments(id),
    status          VARCHAR(20) NOT NULL DEFAULT 'Active'
                        CHECK (status IN ('Active', 'Inactive'))
);

CREATE TABLE users (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(150) NOT NULL,
    phone           VARCHAR(30),
    username        VARCHAR(50) UNIQUE,
    password_hash   VARCHAR(255),
    role            VARCHAR(30) NOT NULL
                        CHECK (role IN ('Manager', 'Driver', 'System Administrator')),
    status          VARCHAR(20) NOT NULL DEFAULT 'Active'
                        CHECK (status IN ('Active', 'Inactive'))
);

CREATE TABLE vehicles (
    id                      SERIAL PRIMARY KEY,
    plate_number            VARCHAR(20) NOT NULL UNIQUE,
    fuel_efficiency_km_per_l NUMERIC(8,2) CHECK (fuel_efficiency_km_per_l IS NULL OR fuel_efficiency_km_per_l > 0),
    vehicle_type_id         INTEGER REFERENCES vehicle_types(id),
    fuel_type_id            INTEGER REFERENCES fuel_types(id),
    status                  VARCHAR(30) NOT NULL DEFAULT 'Active'
                                CHECK (status IN ('Active', 'Out of Service', 'Returned to Provider'))
);

CREATE TABLE trip_requests (
    id                      SERIAL PRIMARY KEY,
    employee_id             INTEGER NOT NULL REFERENCES employees(id),
    destination             VARCHAR(255),
    origin                  VARCHAR(255) NOT NULL,
    planned_distance_km     NUMERIC(8,2) CHECK (planned_distance_km IS NULL OR planned_distance_km > 0),
    trip_type               VARCHAR(30) NOT NULL
                                CHECK (trip_type IN ('One-way', 'Round Trip', 'With Checkpoints')),
    status                  VARCHAR(20) NOT NULL DEFAULT 'Pending'
                                CHECK (status IN ('Pending', 'Assigned', 'Cancelled')),
    requested_at            TIMESTAMP NOT NULL DEFAULT NOW(),
    recorded_by_user_id     INTEGER NOT NULL REFERENCES users(id)
);

CREATE TABLE trip_checkpoints (
    id                  SERIAL PRIMARY KEY,
    trip_request_id     INTEGER NOT NULL REFERENCES trip_requests(id) ON DELETE CASCADE,
    sequence_order      INTEGER NOT NULL,
    location            VARCHAR(255) NOT NULL,
    UNIQUE (trip_request_id, sequence_order)
);

CREATE TABLE trips (
    id                      SERIAL PRIMARY KEY,
    trip_request_id         INTEGER NOT NULL UNIQUE REFERENCES trip_requests(id),
    vehicle_id              INTEGER NOT NULL REFERENCES vehicles(id),
    driver_id               INTEGER NOT NULL REFERENCES users(id),
    status                  VARCHAR(20) NOT NULL DEFAULT 'Assigned'
                                CHECK (status IN ('Assigned', 'In Progress', 'Completed', 'Cancelled')),
    assigned_at             TIMESTAMP NOT NULL DEFAULT NOW(),
    started_at              TIMESTAMP,
    completed_at            TIMESTAMP,
    distance_km             NUMERIC(8,2),
    recorded_by_user_id     INTEGER NOT NULL REFERENCES users(id)
);

CREATE TABLE fuel_transactions (
    id                      SERIAL PRIMARY KEY,
    vehicle_id              INTEGER NOT NULL REFERENCES vehicles(id),
    fueled_date             DATE NOT NULL,
    fuel_type_id            INTEGER REFERENCES fuel_types(id),
    liters                  NUMERIC(8,2) NOT NULL CHECK (liters > 0),
    transaction_ref         VARCHAR(100) NOT NULL UNIQUE,
    status                  VARCHAR(20) NOT NULL DEFAULT 'Recorded'
                                CHECK (status IN ('Recorded', 'Flagged', 'Verified')),
    recorded_by_user_id     INTEGER NOT NULL REFERENCES users(id),
    recorded_at             TIMESTAMP NOT NULL DEFAULT NOW()
);


CREATE TABLE vehicle_maintenance_records (
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

CREATE TABLE location_pings (
    id              SERIAL PRIMARY KEY,
    vehicle_id      INTEGER NOT NULL REFERENCES vehicles(id),
    "timestamp"     TIMESTAMP NOT NULL DEFAULT NOW(),
    latitude        NUMERIC(9,6) NOT NULL,
    longitude       NUMERIC(9,6) NOT NULL
);

CREATE INDEX idx_trip_requests_status        ON trip_requests(status);
CREATE INDEX idx_trips_status                ON trips(status);
CREATE INDEX idx_trips_vehicle_id            ON trips(vehicle_id);
CREATE INDEX idx_trips_driver_id             ON trips(driver_id);
CREATE INDEX idx_fuel_transactions_vehicle   ON fuel_transactions(vehicle_id, fueled_date);
CREATE INDEX idx_fuel_transactions_status    ON fuel_transactions(status);
CREATE INDEX idx_users_role                  ON users(role);
CREATE INDEX idx_location_pings_vehicle_time ON location_pings(vehicle_id, "timestamp");
CREATE INDEX idx_vehicle_maintenance_vehicle_time ON vehicle_maintenance_records(vehicle_id, maintenance_at DESC);
