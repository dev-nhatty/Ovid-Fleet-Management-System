import { api } from './client.js';
export const getRecordFuelOptions = () => api('/fuel-logs/options');
export const createFuelTransaction = (payload) => api('/fuel-logs', { method: 'POST', body: payload });
