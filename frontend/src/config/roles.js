// Values must match users.role CHECK constraint in schema.sql exactly,
// and the role strings the backend returns from /api/auth/login.
export const ROLES = {
  MANAGER: 'Manager',
  DRIVER: 'Driver',
  ADMIN: 'System Administrator',
};

// Display text only. The database value stays "Manager" even though the
// screens say "Officer". Change the wording here and it changes everywhere.
export const ROLE_LABELS = {
  [ROLES.MANAGER]: 'Officer',
  [ROLES.DRIVER]: 'Driver',
  [ROLES.ADMIN]: 'System Admin',
};

// Where each role lands after signing in, and where they are sent back to
// if they wander onto another role's pages. A role with no entry here has
// no web pages (Driver, for now).
export const ROLE_HOME = {
  [ROLES.MANAGER]: '/manager/queue',
  [ROLES.ADMIN]: '/admin/users',
};
