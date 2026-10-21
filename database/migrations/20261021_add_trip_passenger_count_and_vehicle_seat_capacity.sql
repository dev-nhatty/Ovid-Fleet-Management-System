-- Passenger count is additional to the employee requester.
-- seat_capacity is the total number of seats in the vehicle, including the driver's seat.
ALTER TABLE trip_requests
  ADD COLUMN IF NOT EXISTS additional_passenger_count INTEGER NOT NULL DEFAULT 0
  CHECK (additional_passenger_count >= 0);

ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS seat_capacity INTEGER
  CHECK (seat_capacity IS NULL OR seat_capacity >= 2);

ALTER TABLE trips
  ADD COLUMN IF NOT EXISTS capacity_override BOOLEAN NOT NULL DEFAULT FALSE;
