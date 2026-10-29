import axios from 'axios';
import toast from 'react-hot-toast';

// En production : VITE_API_URL configurable (ex: https://api.bennego.com)
// En dev local  : le proxy Vite redirige /api et /uploads vers localhost:3000
const API_ORIGIN = import.meta.env.VITE_API_URL || '';

const api = axios.create({
  baseURL: API_ORIGIN ? `${API_ORIGIN}/api` : '/api',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Intercepteur de réponse pour gérer les erreurs globalement
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.error || 'Erreur de connexion';
    const isLogin = error.config?.url?.includes('/auth/login');

    if (error.response?.status === 401 && !isLogin) {
      localStorage.removeItem('bennego-auth');
      window.location.href = '/login';
    } else if (error.response?.status !== 404 && error.response?.data?.code !== 'ACCOUNT_DELETION_PENDING') {
      toast.error(message);
    }

    return Promise.reject(error);
  }
);

/** Adresse d'un fichier servi par l'API, comme une photo de profil. */
export const mediaUrl = (path) => (path ? `${API_ORIGIN}${path}` : undefined);

export default api;
