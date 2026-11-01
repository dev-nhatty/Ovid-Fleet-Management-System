import { api } from './client.js';

export const getMyDriverTrips = () => api('/driver/trips');
export const requestTripStart = (tripId) => api(`/driver/trips/${tripId}/start-request`, { method: 'POST' });
export const requestTripFinish = (tripId) => api(`/driver/trips/${tripId}/finish-request`, { method: 'POST' });
