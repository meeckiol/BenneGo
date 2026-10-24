import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Redirect, Tabs } from "expo-router";
import { ActivityIndicator, Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HapticTab } from "@/components/haptic-tab";
import { useAuth } from "@/hooks/use-auth";

export default function TabLayout() {
  const { loading, isAuthenticated } = useAuth();
  const insets = useSafeAreaInsets();
  if (loading) return <View style={styles.loading}><ActivityIndicator color="#F26A21" /></View>;
  if (!isAuthenticated) return <Redirect href={"/(auth)/sign-in" as never} />;
  const bottomPadding = Platform.OS === "web" ? 10 : Math.max(insets.bottom, 8);
  return (
    <Tabs screenOptions={{
      tabBarActiveTintColor: "#E55E16",
      tabBarInactiveTintColor: "#7D746E",
      headerShown: false,
      tabBarButton: HapticTab,
      tabBarStyle: { paddingTop: 7, paddingBottom: bottomPadding, height: 58 + bottomPadding, backgroundColor: "#FFFCF9", borderTopColor: "#E9E1DB" },
      tabBarLabelStyle: { fontSize: 11, fontWeight: "700" },
    }}>
      <Tabs.Screen name="index" options={{ title: "Accueil", tabBarIcon: ({ color }) => <MaterialIcons name="dashboard" size={23} color={color} /> }} />
      <Tabs.Screen name="missions" options={{ title: "Missions", tabBarIcon: ({ color }) => <MaterialIcons name="assignment" size={23} color={color} /> }} />
      <Tabs.Screen name="history" options={{ title: "Historique", tabBarIcon: ({ color }) => <MaterialIcons name="timeline" size={23} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: "Profil", tabBarIcon: ({ color }) => <MaterialIcons name="person-outline" size={23} color={color} /> }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({ loading: { flex: 1, backgroundColor: "#F7F3EF", alignItems: "center", justifyContent: "center" } });
