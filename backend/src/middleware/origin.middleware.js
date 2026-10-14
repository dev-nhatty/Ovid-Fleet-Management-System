// Lightweight CSRF defence for a cookie-session API.
//
// Browsers always attach an Origin header to cross-site POST/PUT/PATCH/
// DELETE requests. If that header is present and isn't our frontend,
// refuse the request. Combined with SameSite=Lax cookies and a JSON-only
// API, this closes the CSRF hole without a token library.
// Requests with no Origin header (curl, server-to-server) can't be CSRF,
// because CSRF requires a victim's browser.
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function allowedOriginOnly(allowedOrigin) {
  return (req, res, next) => {
    if (SAFE_METHODS.has(req.method)) return next();

    const origin = req.get('origin');
    if (origin && origin !== allowedOrigin) {
      return res.status(403).json({ error: 'Request origin not allowed' });
    }
    next();
  };
}

module.exports = { allowedOriginOnly };
