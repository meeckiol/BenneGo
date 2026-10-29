import { io } from 'socket.io-client';
import useAdminStore from '../store/adminStore';

// En production : VITE_SOCKET_URL (ou l'adresse de l'API) ; en dev local : '/' (proxy Vite vers le backend)
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || '/';

let socket;

/** Connexion Socket.IO authentifiée de la console (une seule instance par session). */
export function getSocket() {
  const token = useAdminStore.getState().token;
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
