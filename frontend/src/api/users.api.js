import { api } from './client.js';

// Admin-only. The server decides who is allowed; the role you send is the
// role of the NEW account, never the role of whoever is signed in.
export const createUser = (data) => api('/users', { method: 'POST', body: data });

// Filters are all optional. Empty values are left out of the URL.
// Returns { users, total, page, pageSize, totalPages }.
export function listUsers({ role, status, q, page, pageSize } = {}) {
  const params = new URLSearchParams();
  if (role) params.set('role', role);
  if (status) params.set('status', status);
  if (q) params.set('q', q);
  if (page) params.set('page', String(page));
  if (pageSize) params.set('pageSize', String(pageSize));
  const qs = params.toString();
  return api(`/users${qs ? `?${qs}` : ''}`);
}

// Flip an account between Active and Inactive. Inactive accounts keep their
// history but can't sign in. The server refuses (409) to deactivate your own
// account, the last active System Administrator, or a driver on a live trip.
export const updateUserStatus = (id, status) =>
  api(`/users/${id}/status`, { method: 'PATCH', body: { status } });

// Set a new password for someone else (admin only). It ends every session
// that person has open. The server refuses (409) for accounts that don't sign
// in (drivers), and (400) with { fields: { password } } for a weak password.
// Resolves to null on success; the password is never sent back.
export const resetUserPassword = (id, password) =>
  api(`/users/${id}/password`, { method: 'PUT', body: { password } });
