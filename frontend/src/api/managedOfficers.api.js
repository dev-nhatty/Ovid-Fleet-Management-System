import { api } from './client.js';

export function listManagedOfficers({ q = '', status = '' } = {}) {
  const params = new URLSearchParams();
  if (q.trim()) params.set('q', q.trim());
  if (status) params.set('status', status);
  const query = params.toString();
  return api(`/manager/officers${query ? `?${query}` : ''}`);
}
export const createManagedOfficer = (data) =>
  api('/manager/officers', { method: 'POST', body: data });
export const updateManagedOfficerStatus = (id, status) =>
  api(`/manager/officers/${id}/status`, { method: 'PATCH', body: { status } });
