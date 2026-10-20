-- Adds price tracking required by the Record Fuel form.
ALTER TABLE fuel_transactions
  ADD COLUMN IF NOT EXISTS price_per_liter NUMERIC(12,2) NOT NULL DEFAULT 0
  CHECK (price_per_liter >= 0);
