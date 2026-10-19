import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../services/api';

const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      login: async (phone, password) => {
        const response = await api.post('/auth/login', { phone, password });
        const { token, user } = response.data;
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        set({ user, token, isAuthenticated: true });
        return user;
      },

      register: async (data) => {
        const response = await api.post('/auth/register', data);
        const { token, user } = response.data;
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        set({ user, token, isAuthenticated: true });
        return user;
      },

      logout: () => {
        delete api.defaults.headers.common['Authorization'];
        set({ user: null, token: null, isAuthenticated: false });
      },

      setToken: (token) => {
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        set({ token });
      },
    }),
    {
      name: 'logitruck-auth',
      onRehydrateStorage: () => (state) => {
        if (state?.token) {
          api.defaults.headers.common['Authorization'] = `Bearer ${state.token}`;
        }
      },
    }
  )
);

export default useAuthStore;
