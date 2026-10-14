// Named explicitly so logout can clear exactly this cookie, and so it
// doesn't advertise the default "connect.sid" (Express) fingerprint.
const SESSION_COOKIE_NAME = 'ovid.sid';

const EIGHT_HOURS_MS = 8 * 60 * 60 * 1000;

module.exports = { SESSION_COOKIE_NAME, EIGHT_HOURS_MS };
