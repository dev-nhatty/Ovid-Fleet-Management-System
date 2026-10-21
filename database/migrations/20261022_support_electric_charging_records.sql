-- Allow fuel and electric charging records to use the correct quantity and price units.
ALTER TABLE fuel_transactions
  ALTER COLUMN liters DROP NOT NULL,
  ALTER COLUMN price_per_liter DROP NOT NULL;

ALTER TABLE fuel_transactions
  ADD COLUMN IF NOT EXISTS energy_kwh NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS price_per_kwh NUMERIC(12,2);

ALTER TABLE fuel_transactions
  ADD CONSTRAINT fuel_transactions_energy_kwh_positive
    CHECK (energy_kwh IS NULL OR energy_kwh > 0),
  ADD CONSTRAINT fuel_transactions_price_per_kwh_nonnegative
    CHECK (price_per_kwh IS NULL OR price_per_kwh >= 0),
  ADD CONSTRAINT fuel_transactions_quantity_unit_consistency
    CHECK (
      (energy_kwh IS NOT NULL AND price_per_kwh IS NOT NULL AND liters IS NULL AND price_per_liter IS NULL)
      OR
      (energy_kwh IS NULL AND price_per_kwh IS NULL AND liters IS NOT NULL AND price_per_liter IS NOT NULL)
    );
