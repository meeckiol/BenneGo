import { Redirect } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useAuth } from "@/hooks/use-auth";

export default function EntryScreen() {
  const { loading, isAuthenticated } = useAuth();
  if (loading) return <View style={styles.loading}><ActivityIndicator color="#F26A21" /></View>;
  return <Redirect href={(isAuthenticated ? "/(tabs)" : "/(auth)/sign-in") as never} />;
}

const styles = StyleSheet.create({ loading: { flex: 1, backgroundColor: "#1C2321", alignItems: "center", justifyContent: "center" } });
