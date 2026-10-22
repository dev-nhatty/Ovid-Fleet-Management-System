const pool = require('../db/pool');
const { LOGIN_ROLES } = require('../config/roles');
const { SESSION_COOKIE_NAME } = require('../config/session');

// Runs on every protected request.
//
// The session only stores the user's id. On each request we load the
// user's CURRENT row from the database. That means:
//   - deactivating a user locks them out on their very next request
//   - changing a user's role takes effect immediately
// Nothing is cached in the session that could go stale. One primary-key
// lookup per request is cheap at this app's scale.
async function requireAuth(req, res, next) {
  const userId = req.session && req.session.userId;

  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const { rows } = await pool.query(
      'SELECT id, name, username, role, status, is_higher_officer FROM users WHERE id = $1',
      [userId]
    );
    const user = rows[0];

    const stillAllowed =
      user && user.status === 'Active' && LOGIN_ROLES.includes(user.role);

    if (!stillAllowed) {
      // The account was deleted, deactivated, or moved to a role that
      // can't sign in. End the session instead of leaving it dangling.
      return req.session.destroy(() => {
        res.clearCookie(SESSION_COOKIE_NAME);
        res.status(401).json({ error: 'Not authenticated' });
      });
    }

    req.user = { ...user, isHigherOfficer: user.is_higher_officer }; // current database state on every request
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { requireAuth };
