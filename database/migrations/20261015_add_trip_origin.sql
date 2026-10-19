-- Add per-request origin and allow checkpoint trips to use their ordered
-- checkpoint list as destinations without requiring a separate final destination.
BEGIN;

ALTER TABLE trip_requests
  ADD COLUMN IF NOT EXISTS origin VARCHAR(255);

-- Preserve existing records while making origin required for all new requests.
UPDATE trip_requests
   SET origin = 'Origin not recorded'
 WHERE origin IS NULL OR BTRIM(origin) = '';

ALTER TABLE trip_requests
  ALTER COLUMN origin SET NOT NULL,
  ALTER COLUMN destination DROP NOT NULL;

COMMIT;
