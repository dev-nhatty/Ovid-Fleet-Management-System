import { api } from './client.js';

export function listDepartments({ status, q, page = 1, pageSize = 10 } = {}) {
  const params = new URLSearchParams();
  if (status && status !== 'All') params.set('status', status);
  if (q) params.set('q', q);
  params.set('page', String(page));
  params.set('pageSize', String(pageSize));
  return api(`/departments?${params.toString()}`);
}
export const listDepartmentEmployees = () => api('/departments/employees');
export const getDepartment = (id) => api(`/departments/${id}`);
export const createDepartment = (data) => api('/departments', { method: 'POST', body: data });
export const updateDepartment = (id, data) => api(`/departments/${id}`, { method: 'PATCH', body: data });
export const updateDepartmentStatus = (id, status) => api(`/departments/${id}/status`, { method: 'PATCH', body: { status } });
