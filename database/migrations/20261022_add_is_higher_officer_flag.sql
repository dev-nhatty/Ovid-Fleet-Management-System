-- Higher Officer is a privilege flag on the existing Manager role, not a new role.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_higher_officer BOOLEAN NOT NULL DEFAULT FALSE;

-- If an earlier version created a separate Senior Officer role, preserve those
-- accounts by converting them to Manager and carrying the privilege into the flag.
UPDATE users
   SET role = 'Manager', is_higher_officer = TRUE
 WHERE role = 'Senior Officer';

-- Replace any existing role CHECK constraint so the database no longer treats
-- Senior Officer as a separate role.
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname
      FROM pg_constraint
     WHERE conrelid = 'users'::regclass
       AND contype = 'c'
       AND pg_get_constraintdef(oid) ILIKE '%role%'
  LOOP
    EXECUTE format('ALTER TABLE users DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('Manager', 'Driver', 'System Administrator'));
