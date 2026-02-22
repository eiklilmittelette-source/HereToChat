// In dev, use Vite proxy (same origin) so HTTPS works for mobile
// In production (served from Express), also same origin
const isDev = window.location.port === '5173' || window.location.port === '5174';
const API_BASE = isDev ? '' : '';

export function apiUrl(path) {
  return `${API_BASE}${path}`;
}
