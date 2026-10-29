import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../services/api';

/** Type de compte choisi à la connexion : « particulier » (client) ou « entreprise ». */
const DEFAULT_ACCOUNT_TYPE = 'particulier';

const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      accountType: null,

      login: async (phone, password, accountType = DEFAULT_ACCOUNT_TYPE) => {
        const response = await api.post('/auth/login', { phone, password });
        const { token, user } = response.data;
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        set({ user, token, isAuthenticated: true, accountType });
        return user;
      },

      register: async (data) => {
        const response = await api.post('/auth/register', data);
        const { token, user } = response.data;
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        set({ user, token, isAuthenticated: true, accountType: DEFAULT_ACCOUNT_TYPE });
        return user;
      },

      logout: (options) => {
        // Ferme la session de cet appareil côté serveur (elle disparaît des « appareils connectés »).
        // `local` : session déjà fermée par le serveur (compte supprimé), rien à envoyer.
        if (!options?.local) api.post('/account/logout').catch(() => {});
        delete api.defaults.headers.common['Authorization'];
        set({ user: null, token: null, isAuthenticated: false, accountType: null });
      },

      // Reprise d'un compte supprimé il y a moins de 60 jours
      restore: async (phone, password) => {
        const { data } = await api.post('/auth/restore', { phone, password });
        api.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
        set({ user: data.user, token: data.token, isAuthenticated: true, accountType: DEFAULT_ACCOUNT_TYPE });
        return data.user;
      },

      setToken: (token) => {
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        set({ token });
      },

      setProfilePhoto: (url) => set((state) => ({ user: { ...state.user, profile_photo_url: url } })),

      // Après une modification des informations personnelles
      updateUser: (changes) => set((state) => ({ user: { ...state.user, ...changes } })),
    }),
    {
      name: 'bennego-auth',
      onRehydrateStorage: () => (state) => {
        if (state?.token) {
          api.defaults.headers.common['Authorization'] = `Bearer ${state.token}`;
        }
      },
    }
  )
);

/** Type de compte courant. Une session ouverte avant ce choix reste un compte « client ». */
export const selectAccountType = (state) => state.accountType ?? DEFAULT_ACCOUNT_TYPE;

export default useAuthStore;
