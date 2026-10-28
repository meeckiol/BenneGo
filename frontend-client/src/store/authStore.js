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

      logout: () => {
        delete api.defaults.headers.common['Authorization'];
        set({ user: null, token: null, isAuthenticated: false, accountType: null });
      },

      setToken: (token) => {
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        set({ token });
      },

      setProfilePhoto: (url) => set((state) => ({ user: { ...state.user, profile_photo_url: url } })),
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
