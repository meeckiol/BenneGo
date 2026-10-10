import axios from 'axios';
import toast from 'react-hot-toast';

// En prod (Vercel) : VITE_API_URL=https://logitruck-backend.onrender.com
// En dev local    : le proxy Vite redirige /api → localhost:3000 (pas de variable nécessaire)
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.error || 'Erreur de connexion';
    if (error.response?.status === 401) {
      localStorage.removeItem('logitruck-driver-auth');
      window.location.href = '/login';
    } else if (error.response?.status !== 404) {
      toast.error(message);
    }
    return Promise.reject(error);
  }
);

export default api;
