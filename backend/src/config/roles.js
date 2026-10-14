// The ONE place role names are defined on the backend. These strings
// must match the CHECK constraint on users.role exactly.
const ROLES = Object.freeze({
  MANAGER: 'Manager',
  DRIVER: 'Driver',
  ADMIN: 'System Administrator',
});

// Roles allowed to sign in to the web app. Drivers are phoned, not
// logged in, so a Driver row never gets a session even if someone
// gives it a username and password by mistake.
const LOGIN_ROLES = Object.freeze([ROLES.MANAGER, ROLES.ADMIN]);

module.exports = { ROLES, LOGIN_ROLES };
