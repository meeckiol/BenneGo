import "@/global.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState, type ReactNode } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import "@/lib/_core/nativewind-pressable";
import { ThemeProvider } from "@/lib/theme-provider";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { useSocket } from "@/hooks/use-socket";

export const unstable_settings = {
  anchor: "(tabs)",
};

/**
 * Composant interne qui initialise la connexion Socket.IO dès que le chauffeur
 * est authentifié. Placé à l'intérieur de <AuthProvider> pour avoir accès à useAuth().
 * Aucun rendu visuel : il ne fait que gérer le cycle de vie du socket.
 */
function SocketGateway({ children }: { children: ReactNode }) {
  const { isAuthenticated, user } = useAuth();

  // On ne connaît pas isAvailable ici (il vit dans useDriverDashboard).
  // On passe false par défaut : useSocket envoie driver_available uniquement
  // quand le dashboard met à jour la disponibilité via l'effet dédié dans use-socket.ts.
  // La disponibilité réelle est synchronisée depuis useDriverDashboard → setAvailability().
  useSocket(isAuthenticated, false);

  return <>{children}</>;
}

export default function RootLayout() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return (
    <ThemeProvider>
      <SafeAreaProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <SocketGateway>
                <Stack screenOptions={{ headerShown: false }}>
                  <Stack.Screen name="index" />
                  <Stack.Screen name="(auth)" />
                  <Stack.Screen name="(tabs)" />
                  <Stack.Screen name="mission/[id]" />
                </Stack>
                <StatusBar style="auto" />
              </SocketGateway>
            </AuthProvider>
          </QueryClientProvider>
        </GestureHandlerRootView>
      </SafeAreaProvider>
    </ThemeProvider>
  );
}
