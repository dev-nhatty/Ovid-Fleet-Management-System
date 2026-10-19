-- Add descriptive vehicle identity fields used in fleet and trip assignment screens.
-- Existing vehicles remain valid; these fields are nullable so current data is preserved.
ALTER TABLE vehicles
    ADD COLUMN IF NOT EXISTS brand_name VARCHAR(80),
    ADD COLUMN IF NOT EXISTS model_name VARCHAR(80),
    ADD COLUMN IF NOT EXISTS model_year SMALLINT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conname = 'vehicles_model_year_range_check'
           AND conrelid = 'vehicles'::regclass
    ) THEN
        ALTER TABLE vehicles
            ADD CONSTRAINT vehicles_model_year_range_check
            CHECK (model_year IS NULL OR model_year BETWEEN 1900 AND 2100);
    END IF;
END $$;
