import axios from 'axios';
import toast from 'react-hot-toast';

// En production : VITE_API_URL configurable (ex: https://api.bennego.com)
// En dev local  : le proxy Vite redirige /api → localhost:3000
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api',
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
        } else if (error.response?.status !== 404) {
      toast.error(message);
    }

    return Promise.reject(error);
  }
);

export default api;
