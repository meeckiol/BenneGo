import { io } from 'socket.io-client';
import useDriverAuthStore from '../store/authStore';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || '/';

let socket = null;

/**
 * Connexion Socket.IO unique pour toute l'application (courses, position, messages).
 * Elle est recréée si le compte change, et fermée à la déconnexion.
 */
export function getSocket() {
  const token = useDriverAuthStore.getState().token;
  if (!token) return null;
  if (!socket || socket.auth?.token !== token) {
    socket?.disconnect();
    socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 2000,
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
