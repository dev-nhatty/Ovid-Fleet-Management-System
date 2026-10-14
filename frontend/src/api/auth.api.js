import { api } from './client.js';

// Note what is NOT sent: a role. The server looks the user up and
// answers with their role.
export const login = (username, password) =>
  api('/auth/login', { method: 'POST', body: { username, password } });

export const logout = () => api('/auth/logout', { method: 'POST' });

export const fetchMe = () => api('/auth/me');
