import { io } from 'socket.io-client';

let socket = null;

export function connectSocket(token) {
  // Use same origin - in dev, Vite proxy forwards to Express
  // In production, served from same Express server
  socket = io(window.location.origin, {
    auth: { token }
  });
  socket.on('connect_error', (err) => {
    console.error('Socket connection error:', err.message);
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
