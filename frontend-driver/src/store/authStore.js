import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../services/api';

const useDriverAuthStore = create(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      login: async (phone, password) => {
        const { data } = await api.post('/auth/login', { phone, password });
        if (data.user.role !== 'driver') {
          throw new Error('Ce compte n\'est pas un compte chauffeur');
        }
        api.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
        set({ user: data.user, token: data.token, isAuthenticated: true });
        return data.user;
      },

      logout: (options) => {
        // Ferme la session de cet appareil côté serveur (elle disparaît des « appareils connectés »).
        // `local` : session déjà fermée par le serveur (compte supprimé), rien à envoyer.
        if (!options?.local) api.post('/account/logout').catch(() => {});
        delete api.defaults.headers.common['Authorization'];
        set({ user: null, token: null, isAuthenticated: false });
      },

      // Reprise d'un compte supprimé il y a moins de 60 jours
      restore: async (phone, password) => {
        const { data } = await api.post('/auth/restore', { phone, password });
        if (data.user.role !== 'driver') throw new Error('Ce compte n\'est pas un compte chauffeur');
        api.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
        set({ user: data.user, token: data.token, isAuthenticated: true });
        return data.user;
      },

      updateUser: (updates) => set((state) => ({ user: { ...state.user, ...updates } })),
    }),
    {
      name: 'bennego-driver-auth',
      onRehydrateStorage: () => (state) => {
        if (state?.token) {
          api.defaults.headers.common['Authorization'] = `Bearer ${state.token}`;
        }
      },
    }
  )
);

export default useDriverAuthStore;
