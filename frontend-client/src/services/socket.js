import { io } from 'socket.io-client';
import useAuthStore from '../store/authStore';

// En production : VITE_SOCKET_URL configurable (ex: https://api.bennego.com)
// En dev local  : '/' (proxy Vite vers le backend local)
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || '/';

let socket;

/** Connexion Socket.IO authentifiée (une seule instance par session) */
export function getSocket() {
  const token = useAuthStore.getState().token;
  if (!token) return null;
  if (!socket || socket.auth?.token !== token) {
    socket?.close();
    socket = io(SOCKET_URL, { auth: { token }, transports: ['websocket', 'polling'] });
  }
  return socket;
}

export function closeSocket() {
  socket?.close();
  socket = undefined;
}
