import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../services/api';

const useAdminStore = create(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      login: async (phone, password) => {
        const { data } = await api.post('/auth/login', { phone, password });
        if (data.user.role !== 'admin') {
          throw new Error('Accès réservé aux administrateurs');
        }
        api.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
        set({ user: data.user, token: data.token, isAuthenticated: true });
        return data.user;
      },

      logout: () => {
        // Ferme la session de cet appareil côté serveur (elle disparaît des « appareils connectés »)
        api.post('/account/logout').catch(() => {});
        delete api.defaults.headers.common['Authorization'];
        set({ user: null, token: null, isAuthenticated: false });
      },

      updateUser: (changes) => set((state) => ({ user: { ...state.user, ...changes } })),
    }),
    {
      name: 'bennego-admin-auth',
      onRehydrateStorage: () => (state) => {
        if (state?.token) {
          api.defaults.headers.common['Authorization'] = `Bearer ${state.token}`;
        }
      },
    }
  )
);

export default useAdminStore;
