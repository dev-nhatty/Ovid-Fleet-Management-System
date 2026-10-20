import { api } from './client.js';

export function getDashboardSummary() {
  return api('/dashboard');
}
