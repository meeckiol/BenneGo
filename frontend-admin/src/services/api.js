import axios from 'axios';
import toast from 'react-hot-toast';

// En production : VITE_API_URL configurable (ex: https://api.bennego.com)
// En dev local  : le proxy Vite redirige /api → localhost:3000
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.response.use(
  (r) => r,
  (error) => {
    const message = error.response?.data?.error || 'Erreur serveur';
    if (error.response?.status === 401) {
      localStorage.removeItem('bennego-admin-auth');
      window.location.href = '/login';
    } else {
      toast.error(message);
    }
    return Promise.reject(error);
  }
);

export default api;
