import { api } from './client.js';

export async function searchEmployees(query) {
  const params = new URLSearchParams({ q: query });
  return api(`/trip-requests/employees?${params.toString()}`);
}

export async function createTripRequest(data) {
  return api('/trip-requests', { method: 'POST', body: data });
}

export async function listTripRequests({ page = 1, pageSize = 10 } = {}) {
  return api(`/trip-requests?page=${page}&pageSize=${pageSize}`);
}

export async function getAssignmentDetails(requestId) {
  return api(`/trip-requests/${requestId}/assignment-options`);
}

export async function assignTrip(requestId, data) {
  return api(`/trip-requests/${requestId}/assign`, { method: 'POST', body: data });
}
