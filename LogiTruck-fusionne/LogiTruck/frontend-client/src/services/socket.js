import { io } from 'socket.io-client';
import useAuthStore from '../store/authStore';

let socket;

/** Connexion Socket.IO authentifiée (une seule instance par session) */
export function getSocket() {
  const token = useAuthStore.getState().token;
  if (!token) return null;
  if (!socket || socket.auth?.token !== token) {
    socket?.close();
    socket = io('/', { auth: { token }, transports: ['websocket', 'polling'] });
  }
  return socket;
}

export function closeSocket() {
  socket?.close();
  socket = undefined;
}
