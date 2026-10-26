const bcrypt = require('bcrypt');
const pool = require('../db/pool');
const { ROLES, LOGIN_ROLES } = require('../config/roles');

const SALT_ROUNDS = 12;
const USERNAME_RE = /^[a-z0-9._-]{3,50}$/;
const NAME_MAX = 150;
const PASSWORD_MIN = 8;
const PASSWORD_MAX_BYTES = 72; // bcrypt silently ignores everything past 72 bytes

const isString = (v) => typeof v === 'string';

// The one password rule, used by "new user" and "reset password".
// Returns an error message, or '' when the password is acceptable.
function passwordProblem(password) {
  if (!password) return 'Password is required.';
  if (password.length < PASSWORD_MIN) return `Password must be at least ${PASSWORD_MIN} characters.`;
  if (Buffer.byteLength(password, 'utf8') > PASSWORD_MAX_BYTES) return 'Password is too long (72 bytes at most).';
  return '';
}

// Checks everything the form sends and returns BOTH the cleaned values and
// a { field: message } map. The frontend runs the same rules for instant
// feedback, but this is the copy that counts: anyone can call the API
// without the form.
function validateNewUser(body) {
  const b = body && typeof body === 'object' ? body : {};
  const fields = {};

  // role: must be exactly one of the database values
  const role = b.role;
  if (!Object.values(ROLES).includes(role)) fields.role = 'Choose a role.';
  const isHigherOfficer = role === ROLES.MANAGER && b.isHigherOfficer === true;

  // name: trimmed, inner whitespace collapsed
  const name = isString(b.name) ? b.name.trim().replace(/\s+/g, ' ') : '';
  if (!name) fields.name = 'Full name is required.';
  else if (name.length < 2) fields.name = 'Full name is too short.';
  else if (name.length > NAME_MAX) fields.name = `Full name can be at most ${NAME_MAX} characters.`;

  // phone: optional, except drivers are contacted by phone so they need one
  let phone = null;
  if (b.phone != null && !isString(b.phone)) {
    fields.phone = 'Enter a valid phone number.';
  } else {
    const raw = isString(b.phone) ? b.phone.trim() : '';
    if (!raw) {
      if (role === ROLES.DRIVER) fields.phone = 'Phone is required for drivers.';
    } else {
      const digits = raw.replace(/\D/g, '');
      const shapeOk = /^\+?[0-9][0-9\s-]*$/.test(raw);
      if (!shapeOk || digits.length < 7 || digits.length > 15 || raw.length > 30) {
        fields.phone = 'Enter a valid phone number, e.g. +251 91 123 4567.';
      } else {
        phone = raw;
      }
    }
  }

  // sign-in credentials: only for roles that can sign in. A Driver never
  // gets a username or password, even if the request includes them.
  let username = null;
  let password = null;
  if (LOGIN_ROLES.includes(role)) {
    username = isString(b.username) ? b.username.trim() : '';
    if (!username) {
      fields.username = 'Username is required.';
    } else if (!USERNAME_RE.test(username)) {
      fields.username = 'Use 3-50 lowercase letters, numbers, dots, dashes or underscores.';
    }

    password = isString(b.password) ? b.password : '';
    const problem = passwordProblem(password);
    if (problem) fields.password = problem;
  }

  return { fields, value: { name, phone, role, username, password, isHigherOfficer } };
}

function usernameTaken(res) {
  return res.status(409).json({
    error: 'That username is already taken.',
    fields: { username: 'This username is already taken.' },
  });
}

// POST /api/users   (System Administrator only; see app.js)
async function createUser(req, res, next) {
  const { fields, value } = validateNewUser(req.body);

  if (Object.keys(fields).length > 0) {
    return res.status(400).json({ error: 'Please correct the highlighted fields.', fields });
  }

  try {
    // Case-insensitive, so "Sara.T" can't sneak in next to "sara.t".
    if (value.username) {
      const dup = await pool.query(
        'SELECT 1 FROM users WHERE LOWER(username) = $1',
        [value.username.toLowerCase()]
      );
      if (dup.rowCount > 0) return usernameTaken(res);
    }

    const passwordHash = value.password
      ? await bcrypt.hash(value.password, SALT_ROUNDS)
      : null;

    const { rows } = await pool.query(
      `INSERT INTO users (name, phone, username, password_hash, role, is_higher_officer, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'Active')
       RETURNING id, name, phone, username, role, is_higher_officer, status`,
      [value.name, value.phone, value.username, passwordHash, value.role, value.isHigherOfficer]
    );

    // The hash is never part of the response.
    const created = rows[0];
    res.status(201).json({ ...created, isHigherOfficer: Boolean(created.is_higher_officer) });
  } catch (err) {
    // Two admins submitting the same username at the same moment: the
    // UNIQUE constraint is the final referee.
    if (err.code === '23505') return usernameTaken(res);
    next(err);
  }
}


// ---------------------------------------------------------------------------
// GET /api/users   (System Administrator only; see app.js)
//
//   ?role=Manager|Driver|System Administrator   (optional)
//   ?status=Active|Inactive                      (optional)
//   ?q=text      matches name or username, case-insensitive (optional)
//   ?page=1&pageSize=10                          (pageSize 1-100)
//
// Returns { users, total, page, pageSize, totalPages }.
// total is the number of users matching the filters (not the whole table),
// and page is the page actually returned (it is pulled back into range if
// you ask for one past the end, e.g. after the last user on it was removed).
// ---------------------------------------------------------------------------
const STATUSES = ['Active', 'Inactive'];
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;
const SEARCH_MAX = 100;

// Query values arrive as strings (or arrays if a key is repeated).
const one = (v) => (typeof v === 'string' ? v : undefined);

// % and _ are wildcards in LIKE; a search for "50%" should mean the
// literal text, not "anything".
const escapeLike = (text) => text.replace(/[\\%_]/g, '\\$&');

function parseListQuery(query) {
  const errors = {};

  const role = one(query.role);
  if (role !== undefined && role !== '' && !Object.values(ROLES).includes(role)) {
    errors.role = 'Unknown role.';
  }

  const status = one(query.status);
  if (status !== undefined && status !== '' && !STATUSES.includes(status)) {
    errors.status = 'Status must be Active or Inactive.';
  }

  const q = (one(query.q) ?? '').trim().slice(0, SEARCH_MAX);

  const toInt = (v, fallback) => {
    const n = Number.parseInt(one(v), 10);
    return Number.isInteger(n) ? n : fallback;
  };
  const page = Math.max(1, toInt(query.page, 1));
  // Zero, negative or non-numeric sizes are nonsense, so they get the default
  // rather than being squeezed up to 1.
  const requestedSize = toInt(query.pageSize, DEFAULT_PAGE_SIZE);
  const pageSize = requestedSize >= 1 ? Math.min(MAX_PAGE_SIZE, requestedSize) : DEFAULT_PAGE_SIZE;

  return { errors, role: role || null, status: status || null, q, page, pageSize };
}

async function listUsers(req, res, next) {
  const f = parseListQuery(req.query);
  if (Object.keys(f.errors).length > 0) {
    return res.status(400).json({ error: 'Invalid filter.', fields: f.errors });
  }

  try {
    // Build the WHERE clause. Every value goes in as a $n parameter, never
    // pasted into the SQL text.
    const where = [];
    const params = [];
    if (f.role) { params.push(f.role); where.push(`role = $${params.length}`); }
    if (f.status) { params.push(f.status); where.push(`status = $${params.length}`); }
    if (f.q) {
      params.push(`%${escapeLike(f.q)}%`);
      where.push(`(name ILIKE $${params.length} OR username ILIKE $${params.length})`);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total FROM users ${whereSql}`,
      params
    );
    const total = countResult.rows[0].total;
    const totalPages = Math.max(1, Math.ceil(total / f.pageSize));
    const page = Math.min(f.page, totalPages);

    // is_last_active_admin lets the screen grey out "Change Role" and
    // "Deactivate" on the only active System Administrator. (The server
    // will enforce that rule itself when those endpoints are built.)
    const dataParams = [...params, ROLES.ADMIN, f.pageSize, (page - 1) * f.pageSize];
    const adminIdx = params.length + 1;
    const limitIdx = params.length + 2;
    const offsetIdx = params.length + 3;

    const { rows } = await pool.query(
      `SELECT id, name, phone, username, role, is_higher_officer, status,
              (role = $${adminIdx} AND status = 'Active' AND
                (SELECT COUNT(*) FROM users
                  WHERE role = $${adminIdx} AND status = 'Active') = 1
              ) AS is_last_active_admin
         FROM users
         ${whereSql}
        ORDER BY LOWER(name), id
        LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      dataParams
    );

    const users = rows.map(({ is_last_active_admin, ...u }) => ({
      ...u,
      isLastActiveAdmin: is_last_active_admin,
      isHigherOfficer: Boolean(u.is_higher_officer),
    }));

    res.json({ users, total, page, pageSize: f.pageSize, totalPages });
  } catch (err) {
    next(err);
  }
}


// ---------------------------------------------------------------------------
// PATCH /api/users/:id/status   body: { "status": "Active" | "Inactive" }
// (System Administrator only; see app.js)
//
// Deactivating keeps the account and its history, but blocks sign-in: the
// auth middleware re-reads the user's status on every request, so someone
// who is signed in at that moment is locked out on their very next click.
//
// Rules, all enforced here (the greyed-out button in the UI is only a hint):
//   - you can't deactivate your own account
//   - the last active System Administrator can't be deactivated
//   - a driver with an Assigned / In Progress trip can't be deactivated
// ---------------------------------------------------------------------------
const MAX_INT4 = 2147483647;
const ADMIN_CHANGE_LOCK = 710001; // any constant; see pg_advisory_xact_lock below

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// The id comes from the URL: digits only, and small enough for an INTEGER
// column (otherwise Postgres would throw and the caller would see a 500).
// Returns the id, or NaN when it isn't usable.
function parseUserId(rawId) {
  const id = /^\d{1,10}$/.test(rawId) ? Number(rawId) : NaN;
  return Number.isInteger(id) && id >= 1 && id <= MAX_INT4 ? id : NaN;
}

async function updateUserStatus(req, res, next) {
  const id = parseUserId(req.params.id);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid user id.' });
  }

  const status = req.body && req.body.status;
  if (!STATUSES.includes(status)) {
    return res.status(400).json({
      error: 'Status must be Active or Inactive.',
      fields: { status: 'Status must be Active or Inactive.' },
    });
  }

  if (status === 'Inactive' && id === req.user.id) {
    return res.status(409).json({ error: "You can't deactivate your own account." });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // One status change at a time. Without this, two administrators
    // deactivating each other in the same instant could both pass the
    // "is another admin still active?" check and leave nobody able to sign
    // in. The lock is released automatically at COMMIT / ROLLBACK.
    await client.query('SELECT pg_advisory_xact_lock($1)', [ADMIN_CHANGE_LOCK]);

    const found = await client.query(
      'SELECT id, name, phone, username, role, status FROM users WHERE id = $1 FOR UPDATE',
      [id]
    );
    const target = found.rows[0];
    if (!target) throw new HttpError(404, 'User not found.');

    // Already in the requested state (e.g. someone else just changed it):
    // nothing to do, and that's not an error.
    if (target.status === status) {
      await client.query('COMMIT');
      return res.json(target);
    }

    if (status === 'Inactive') {
      if (target.role === ROLES.ADMIN) {
        const others = await client.query(
          `SELECT COUNT(*)::int AS n FROM users
            WHERE role = $1 AND status = 'Active' AND id <> $2`,
          [ROLES.ADMIN, id]
        );
        if (others.rows[0].n === 0) {
          throw new HttpError(409, 'At least one active System Administrator is required.');
        }
      }

      if (target.role === ROLES.DRIVER) {
        const busy = await client.query(
          `SELECT 1 FROM trips
            WHERE driver_id = $1 AND status IN ('Assigned', 'In Progress')
            LIMIT 1`,
          [id]
        );
        if (busy.rowCount > 0) {
          throw new HttpError(
            409,
            `${target.name} has an active trip. Complete or cancel it first.`
          );
        }
      }
    }

    const updated = await client.query(
      `UPDATE users SET status = $1 WHERE id = $2
       RETURNING id, name, phone, username, role, status`,
      [status, id]
    );
    await client.query('COMMIT');
    res.json(updated.rows[0]);
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* connection already gone */ }
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.message });
    }
    next(err);
  } finally {
    client.release();
  }
}


// ---------------------------------------------------------------------------
// PUT /api/users/:id/password   body: { "password": "..." }
// (System Administrator only; see app.js)
//
// An administrator sets a new password for someone else. Rules:
//   - only accounts that can sign in have a password (Manager / System
//     Administrator with a username); a Driver has none to reset
//   - the new password follows the same rules as when the account was created
//   - every session the user has open is ended, so whoever knew the old
//     password (or held a stolen session) is out immediately
//   - the administrator's OWN current session is kept when they reset
//     their own password, so they aren't thrown out mid-task
// The password is never logged and never sent back.
// ---------------------------------------------------------------------------
async function resetUserPassword(req, res, next) {
  const id = parseUserId(req.params.id);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid user id.' });
  }

  const password = req.body && isString(req.body.password) ? req.body.password : '';
  const problem = passwordProblem(password);
  if (problem) {
    return res.status(400).json({ error: problem, fields: { password: problem } });
  }

  let client;
  try {
    // Hash first: it takes a few hundred milliseconds, and the database
    // connection shouldn't sit locked while we wait for it.
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    client = await pool.connect();
    await client.query('BEGIN');

    const found = await client.query(
      'SELECT id, name, username, role FROM users WHERE id = $1 FOR UPDATE',
      [id]
    );
    const target = found.rows[0];
    if (!target) throw new HttpError(404, 'User not found.');

    if (!LOGIN_ROLES.includes(target.role) || !target.username) {
      throw new HttpError(409, `${target.name} doesn't sign in, so there is no password to reset.`);
    }

    await client.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, id]);

    // Sessions live in the "session" table (connect-pg-simple); the user's
    // id is inside the JSON. Same transaction as the update above, so a
    // new password never exists alongside the old sessions.
    await client.query(
      `DELETE FROM session WHERE sess->>'userId' = $1 AND sid <> $2`,
      [String(id), req.sessionID]
    );

    await client.query('COMMIT');
    res.status(204).send();
  } catch (err) {
    if (client) {
      try { await client.query('ROLLBACK'); } catch { /* connection already gone */ }
    }
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.message });
    }
    next(err);
  } finally {
    if (client) client.release();
  }
}

// PATCH /api/users/:id/higher-officer { isHigherOfficer: boolean }
// Only the System Administrator can reach this router. The privilege is a
// flag on Manager, not a separate role, so existing Manager route checks stay intact.
async function updateHigherOfficer(req, res, next) {
  const id = parseUserId(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid user id.' });
  const enabled = req.body && req.body.isHigherOfficer;
  if (typeof enabled !== 'boolean') {
    return res.status(400).json({ error: 'isHigherOfficer must be true or false.' });
  }
  try {
    const { rows } = await pool.query(
      `UPDATE users
          SET is_higher_officer = $1
        WHERE id = $2 AND role = $3
        RETURNING id, name, phone, username, role, is_higher_officer, status`,
      [enabled, id, ROLES.MANAGER]
    );
    if (!rows[0]) {
      const found = await pool.query('SELECT id, role FROM users WHERE id = $1', [id]);
      if (!found.rowCount) return res.status(404).json({ error: 'User not found.' });
      return res.status(409).json({ error: 'Only an Officer/Manager account can be made a Higher Officer.' });
    }
    return res.json({ ...rows[0], isHigherOfficer: Boolean(rows[0].is_higher_officer) });
  } catch (err) {
    next(err);
  }
}



// Higher Officer management: only create/list ordinary Officer (Manager) accounts.
async function listManagedOfficers(req, res, next) {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
    const status = typeof req.query.status === 'string' ? req.query.status : '';
    if (status && !['Active', 'Inactive'].includes(status)) {
      return res.status(400).json({ error: 'Status must be Active or Inactive.' });
    }
    const params = [];
    const clauses = [`role = $${params.push(ROLES.MANAGER)}`];
    if (status) clauses.push(`status = $${params.push(status)}`);
    if (q) clauses.push(`(name ILIKE $${params.push('%' + q.replace(/[\\%_]/g, '\\$&') + '%')} OR username ILIKE $${params.length})`);
    const { rows } = await pool.query(
      `SELECT id, name, phone, username, role, status, is_higher_officer
         FROM users WHERE ${clauses.join(' AND ')}
        ORDER BY name ASC`,
      params
    );
    res.json({ officers: rows.map((u) => ({ ...u, isHigherOfficer: Boolean(u.is_higher_officer) })) });
  } catch (err) { next(err); }
}

async function createManagedOfficer(req, res, next) {
  const body = req.body || {};
  const errors = {};
  const name = typeof body.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : '';
  const phoneRaw = typeof body.phone === 'string' ? body.phone.trim() : '';
  const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (name.length < 2 || name.length > 150) errors.name = 'Enter a full name (2–150 characters).';
  let phone = null;
  if (phoneRaw) {
    const digits = phoneRaw.replace(/\D/g, '');
    if (!/^\+?[0-9][0-9\s-]*$/.test(phoneRaw) || digits.length < 7 || digits.length > 15 || phoneRaw.length > 30) errors.phone = 'Enter a valid phone number.';
    else phone = phoneRaw;
  }
  if (!/^[a-z0-9._-]{3,50}$/.test(username)) errors.username = 'Use 3–50 lowercase letters, numbers, dots, dashes or underscores.';
  if (password.length < 8) errors.password = 'Password must be at least 8 characters.';
  else if (Buffer.byteLength(password, 'utf8') > 72) errors.password = 'Password must be at most 72 bytes.';
  if (body.confirmPassword !== password) errors.confirmPassword = "Passwords don't match.";
  if (Object.keys(errors).length) return res.status(400).json({ error: 'Please correct the highlighted fields.', fields: errors });
  try {
    const dup = await pool.query('SELECT 1 FROM users WHERE LOWER(username) = $1', [username]);
    if (dup.rowCount) return res.status(409).json({ error: 'Username already taken.', fields: { username: 'This username is already taken.' } });
    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    const { rows } = await pool.query(
      `INSERT INTO users (name, phone, username, password_hash, role, is_higher_officer, status)
       VALUES ($1, $2, $3, $4, $5, FALSE, 'Active')
       RETURNING id, name, phone, username, role, status, is_higher_officer`,
      [name, phone, username, hash, ROLES.MANAGER]
    );
    const u = rows[0];
    res.status(201).json({ ...u, isHigherOfficer: false });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Username already taken.', fields: { username: 'This username is already taken.' } });
    next(err);
  }
}

async function updateManagedOfficerStatus(req, res, next) {
  const id = Number.parseInt(req.params.id, 10);
  const status = req.body && req.body.status;
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid officer id.' });
  if (!['Active', 'Inactive'].includes(status)) return res.status(400).json({ error: 'Status must be Active or Inactive.' });
  if (String(req.user.id) === String(id) && status === 'Inactive') return res.status(409).json({ error: 'You cannot deactivate your own account.' });
  try {
    const { rows } = await pool.query(
      `UPDATE users SET status = $1
        WHERE id = $2 AND role = $3 AND is_higher_officer = FALSE
        RETURNING id, name, phone, username, role, status, is_higher_officer`,
      [status, id, ROLES.MANAGER]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Officer not found or cannot be managed from this page.' });
    res.json({ ...rows[0], isHigherOfficer: false });
  } catch (err) { next(err); }
}

module.exports = { createUser, listUsers, updateUserStatus, resetUserPassword, updateHigherOfficer, listManagedOfficers, createManagedOfficer, updateManagedOfficerStatus, validateNewUser, passwordProblem };
