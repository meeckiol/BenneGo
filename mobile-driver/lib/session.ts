import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const TOKEN_KEY = "logitruck-token";
const USER_KEY = "logitruck-user";

export type SessionUser = { id: string; phone: string; full_name: string; role: string };

// Jeton : coffre sécurisé du téléphone (Keychain/Keystore). Sur le web, seul AsyncStorage existe.
export async function getToken(): Promise<string | null> {
  return Platform.OS === "web" ? AsyncStorage.getItem(TOKEN_KEY) : SecureStore.getItemAsync(TOKEN_KEY);
}

export async function saveSession(token: string, user: SessionUser) {
  if (Platform.OS === "web") await AsyncStorage.setItem(TOKEN_KEY, token);
  else await SecureStore.setItemAsync(TOKEN_KEY, token);
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
}

export async function getStoredUser(): Promise<SessionUser | null> {
  const raw = await AsyncStorage.getItem(USER_KEY);
  return raw ? (JSON.parse(raw) as SessionUser) : null;
}

export async function clearSession() {
  if (Platform.OS === "web") await AsyncStorage.removeItem(TOKEN_KEY);
  else await SecureStore.deleteItemAsync(TOKEN_KEY);
  await AsyncStorage.removeItem(USER_KEY);
}
