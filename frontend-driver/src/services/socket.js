import { io } from 'socket.io-client';
import useDriverAuthStore from '../store/authStore';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || '/';

let socket = null;

export function getSocket() {
  if (!socket) {
    const token = useDriverAuthStore.getState().token;
    socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionAttempts: 10,
    });
  }
  return socket;
}

export function destroySocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
