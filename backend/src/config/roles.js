// The ONE place role names are defined on the backend. These strings
// must match the CHECK constraint on users.role exactly.
const ROLES = Object.freeze({
  MANAGER: 'Manager',
  DRIVER: 'Driver',
  ADMIN: 'System Administrator',
});

// Roles allowed to sign in to the web app. Driver accounts use the same
// session authentication as officers, but their API routes are restricted.
const LOGIN_ROLES = Object.freeze([ROLES.MANAGER, ROLES.DRIVER, ROLES.ADMIN]);

module.exports = { ROLES, LOGIN_ROLES };
