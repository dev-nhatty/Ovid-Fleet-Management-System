const bcrypt = require('bcrypt');
const pool = require('../db/pool');
const { LOGIN_ROLES } = require('../config/roles');
const { SESSION_COOKIE_NAME } = require('../config/session');

const SALT_ROUNDS = 12;

// A real bcrypt hash of a throwaway string. When the username doesn't
// exist we still run one bcrypt comparison against this, so "unknown
// user" and "wrong password" take the same time. Without it, response
// speed would reveal which usernames exist.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', SALT_ROUNDS);

const MAX_FIELD_LENGTH = 128;

// The only shape of user data that ever leaves the server.
function publicUser(user) {
  return { id: user.id, name: user.name, username: user.username, role: user.role, isHigherOfficer: Boolean(user.is_higher_officer ?? user.isHigherOfficer) };
}

function invalidCredentials(res) {
  return res.status(401).json({ error: 'Invalid username or password' });
}

async function login(req, res, next) {
  const { username, password } = req.body || {};

  if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  if (username.length > MAX_FIELD_LENGTH || password.length > MAX_FIELD_LENGTH) {
    return invalidCredentials(res);
  }

  try {
    const { rows } = await pool.query(
      `SELECT id, name, username, password_hash, role, status, is_higher_officer
       FROM users
       WHERE username = $1`,
      [username]
    );
    const user = rows[0];

    // Always do exactly one bcrypt comparison, real or dummy.
    const passwordOk = await bcrypt.compare(
      password,
      (user && user.password_hash) || DUMMY_HASH
    );

    // One combined check, one generic answer. The caller can't tell
    // whether the username was unknown, the password was wrong, the
    // account is inactive, or the role isn't allowed to sign in.
    const allowed =
      user &&
      user.password_hash &&
      passwordOk &&
      user.status === 'Active' &&
      LOGIN_ROLES.includes(user.role);

    if (!allowed) {
      return invalidCredentials(res);
    }

    // New session id on every login (prevents session fixation).
    req.session.regenerate((err) => {
      if (err) return next(err);

      req.session.userId = user.id; // id only; role is read fresh per request

      req.session.save((saveErr) => {
        if (saveErr) return next(saveErr);
        // The frontend reads `role` from this response to decide
        // which page to open. The user never chooses a role.
        res.json(publicUser(user));
      });
    });
  } catch (err) {
    next(err);
  }
}

// Safe to call with or without a live session.
function logout(req, res, next) {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie(SESSION_COOKIE_NAME);
    res.status(204).send();
  });
}

// "Who am I?" The frontend calls this on page load so a refresh keeps
// you signed in. Mounted behind requireAuth, so req.user is set.
function me(req, res) {
  res.json(publicUser(req.user));
}

module.exports = { login, logout, me };
