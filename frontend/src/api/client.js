// The one place that talks to the backend.
//
// - Paths start with /api. In development the Vite proxy forwards them
//   to Express, so the browser sees ONE origin and the session cookie
//   just works.
// - credentials: 'include' makes the browser send the session cookie.
// - Errors are thrown as ApiError so callers can check err.status.

export class ApiError extends Error {
  constructor(status, message, fields = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fields = fields; // e.g. { username: 'This username is already taken.' }
  }
}

// AuthContext registers a function here. If ANY request later comes back
// 401 (the session expired or the account was deactivated while the
// person was using the app), that function signs them out locally.
let onUnauthorized = () => {};
export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

export async function api(path, { method = 'GET', body } = {}) {
  const response = await fetch(`/api${path}`, {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (response.status === 204) return null;

  let data = null;
  try {
    data = await response.json();
  } catch {
    // body wasn't JSON; fall through to the generic message below
  }

  if (!response.ok) {
    // /auth/* answers 401 for "wrong password" or "not signed in yet",
    // which the login screen and AuthContext handle themselves.
    if (response.status === 401 && !path.startsWith('/auth/')) {
      onUnauthorized();
    }
    throw new ApiError(
      response.status,
      (data && data.error) || 'Something went wrong',
      (data && data.fields) || null
    );
  }

  return data;
}
