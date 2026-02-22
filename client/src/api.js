// Use same origin in production (served from Express), port 3001 in dev
const isDev = window.location.port === '5173' || window.location.port === '5174';
const API_BASE = isDev ? `http://${window.location.hostname}:3001` : '';

export function apiUrl(path) {
  return `${API_BASE}${path}`;
}
