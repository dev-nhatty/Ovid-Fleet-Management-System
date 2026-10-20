-- Extend the existing departments table for administrator-managed master data.
-- Existing departments are preserved and receive stable, unique codes.
BEGIN;

ALTER TABLE departments
  ADD COLUMN IF NOT EXISTS code VARCHAR(20),
  ADD COLUMN IF NOT EXISTS description VARCHAR(500),
  ADD COLUMN IF NOT EXISTS department_head_employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL;

UPDATE departments
   SET code = 'DEPT-' || LPAD(id::text, 3, '0')
 WHERE code IS NULL OR BTRIM(code) = '';

ALTER TABLE departments ALTER COLUMN code SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS departments_code_unique_idx ON departments (UPPER(code));
CREATE UNIQUE INDEX IF NOT EXISTS departments_name_unique_idx ON departments (LOWER(name));
CREATE INDEX IF NOT EXISTS employees_department_id_idx ON employees(department_id);

COMMIT;
