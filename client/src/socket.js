import { io } from 'socket.io-client';

let socket = null;

export function connectSocket(token) {
  // Use same origin in production, port 3001 in dev
  const isDev = window.location.port === '5173' || window.location.port === '5174';
  const url = isDev ? `http://${window.location.hostname}:3001` : window.location.origin;
  socket = io(url, {
    auth: { token }
  });
  return socket;
}

export function getSocket() {
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
