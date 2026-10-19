import { io } from 'socket.io-client';
import useAuthStore from '../store/authStore';

// En prod (Vercel) : VITE_SOCKET_URL=https://logitruck-backend.onrender.com
// En dev local    : '/' (même origine, proxy Vite gère /socket.io)
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
