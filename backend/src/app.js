const express = require('express');
const session = require('express-session');
const pgSessionFactory = require('connect-pg-simple');
const cors = require('cors');

const pool = require('./db/pool');
const { SESSION_COOKIE_NAME, EIGHT_HOURS_MS } = require('./config/session');
const { requireAuth } = require('./middleware/auth.middleware');
const { requireRole } = require('./middleware/role.middleware');
const { ROLES } = require('./config/roles');
const { allowedOriginOnly } = require('./middleware/origin.middleware');
const { errorHandler } = require('./middleware/error.middleware');

const authRoutes = require('./routes/auth.routes');
const authCheckRoutes = require('./routes/authCheck.routes'); // temporary
const usersRoutes = require('./routes/users.routes');
const tripRequestsRoutes = require('./routes/tripRequests.routes');
const vehiclesRoutes = require('./routes/vehicles.routes');
const driversRoutes = require('./routes/drivers.routes');
const tripsRoutes = require('./routes/trips.routes');

if (!process.env.SESSION_SECRET) {
  // Fail at startup, not on the first login.
  throw new Error('SESSION_SECRET is not set. Add it to your .env file.');
}

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const isProduction = process.env.NODE_ENV === 'production';
const PgSession = pgSessionFactory(session);

const app = express();

// Behind nginx / a cloud load balancer, Express only sees the proxy's
// address and thinks the connection is plain HTTP, which would stop the
// Secure cookie from being set. This tells it to trust the proxy.
if (isProduction) app.set('trust proxy', 1);

// Only needed when the browser calls this server directly. With the
// Vite dev proxy (see vite.config.js) requests are same-origin and CORS
// never triggers, but keeping it strict costs nothing.
app.use(cors({ origin: FRONTEND_URL, credentials: true }));
app.use(express.json({ limit: '100kb' }));
app.use(allowedOriginOnly(FRONTEND_URL));

app.use(
  session({
    name: SESSION_COOKIE_NAME,
    store: new PgSession({
      pool,
      tableName: 'session',
      createTableIfMissing: true, // makes the session table on first run
    }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false, // no cookie for visitors who never log in
    rolling: true, // each request restarts the clock: 8h of INACTIVITY logs you out
    cookie: {
      httpOnly: true, // JavaScript can't read it, so XSS can't steal it
      secure: isProduction, // HTTPS only in production
      sameSite: 'lax', // not sent on cross-site POSTs
      maxAge: EIGHT_HOURS_MS,
    },
  })
);

// PUBLIC: login / logout (and /me, which guards itself).
app.use('/api/auth', authRoutes);

// EVERYTHING BELOW THIS LINE REQUIRES A SIGNED-IN USER. Any router you
// mount after this is protected by default, so you can't forget.
app.use('/api', requireAuth);

app.use('/api/auth-check', authCheckRoutes); // temporary

app.use('/api/users', requireRole(ROLES.ADMIN), usersRoutes);
app.use('/api/trip-requests', tripRequestsRoutes);
app.use('/api/vehicles', vehiclesRoutes);
app.use('/api/drivers', driversRoutes);
app.use('/api/trips', tripsRoutes);

// Real routes go here, each narrowed to the roles that may use it:
// app.use('/api/trip-requests', requireRole(ROLES.MANAGER), tripRequestsRoutes);
// app.use('/api/users',         requireRole(ROLES.ADMIN),   usersRoutes);

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// Must be last.
app.use(errorHandler);

module.exports = app;
