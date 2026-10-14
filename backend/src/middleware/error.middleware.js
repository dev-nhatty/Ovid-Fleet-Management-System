// Central error handler. Your stored procedures raise readable
// Postgres exceptions (e.g. "Vehicle % is %; only Active vehicles
// can be assigned") via RAISE EXCEPTION — node-postgres surfaces
// those as err.message with err.code 'P0001'. Anything else is an
// unexpected server error and gets a generic message, since its
// raw message could leak internal details.
function errorHandler(err, req, res, next) {
  console.error(err);

  if (err.code === 'P0001') {
    return res.status(400).json({ error: err.message });
  }

  // Postgres unique_violation, not caught explicitly inside a
  // procedure (e.g. a race on a UNIQUE column).
  if (err.code === '23505') {
    return res.status(409).json({ error: 'That record already exists' });
  }

  res.status(500).json({ error: 'Something went wrong, please try again' });
}

module.exports = { errorHandler };
