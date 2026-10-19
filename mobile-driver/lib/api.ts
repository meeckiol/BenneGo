import axios from "axios";
import Constants from "expo-constants";
import { clearSession, getToken } from "@/lib/session";

/** URL du backend LogiTruck (EXPO_PUBLIC_API_URL). Sur émulateur Android : http://10.0.2.2:3000 */
export const API_URL: string =
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) || process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";

let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (fn: (() => void) | null) => { onUnauthorized = fn; };

export const api = axios.create({ baseURL: `${API_URL}/api`, timeout: 15000 });

api.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    if (error.response?.status === 401 && error.config?.url !== "/auth/login") {
      await clearSession();
      onUnauthorized?.();
    }
    return Promise.reject(error);
  },
);

/** Message lisible à partir d'une erreur axios */
export function errorMessage(error: unknown, fallback = "Une erreur est survenue.") {
  if (axios.isAxiosError(error)) {
    if (!error.response) return "Serveur injoignable. Vérifiez votre connexion.";
    return (error.response.data as { error?: string })?.error ?? fallback;
  }
  return error instanceof Error ? error.message : fallback;
}
