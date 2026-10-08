import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useState } from "react";
import { Alert, Image, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { startOAuthLogin } from "@/constants/oauth";

export default function SignInScreen() {
  const [loading, setLoading] = useState(false);
  const signIn = async () => {
    try {
      setLoading(true);
      await startOAuthLogin();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Connexion indisponible.";
      if (Platform.OS === "web") window.alert(message);
      else Alert.alert("Connexion", message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom", "left", "right"]}>
      <View style={styles.container}>
        <View style={styles.hero}>
          <View style={styles.logoMark}>
            <Image source={require("../../assets/images/logitruck-icon.png")} style={styles.logoImage} resizeMode="contain" />
          </View>
          <Text style={styles.wordmark}>Logi<Text style={styles.wordmarkAccent}>Truck</Text></Text>
          <Text style={styles.kicker}>DRIVER</Text>
        </View>
        <View style={styles.copy}>
          <Text style={styles.title}>Votre poste de conduite, au clair.</Text>
          <Text style={styles.body}>Consultez vos missions, avancez chaque étape et partagez votre position uniquement lorsque vous le décidez.</Text>
        </View>
        <View style={styles.bottom}>
          <Pressable onPress={signIn} disabled={loading} style={({ pressed }) => [styles.button, pressed && styles.pressed, loading && styles.disabled]}>
            <Text style={styles.buttonText}>{loading ? "Ouverture de la connexion…" : "Se connecter avec Manus"}</Text>
            <MaterialIcons name="arrow-forward" color="#FFFFFF" size={20} />
          </Pressable>
          <Text style={styles.footnote}>Accès réservé aux chauffeurs activés par les opérations LogiTruck.</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#1C2321" },
  container: { flex: 1, paddingHorizontal: 26, paddingVertical: 30, justifyContent: "space-between" },
  hero: { alignItems: "flex-start", gap: 8, marginTop: 28 },
  logoMark: { width: 76, height: 76, borderRadius: 20, backgroundColor: "#F26A21", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  logoImage: { width: 76, height: 76 },
  wordmark: { color: "#F7F3EF", fontSize: 33, fontWeight: "900", letterSpacing: -1.4, marginTop: 12 },
  wordmarkAccent: { color: "#F26A21" },
  kicker: { color: "#CBBFB7", fontSize: 11, letterSpacing: 3, fontWeight: "800" },
  copy: { gap: 14 },
  title: { color: "#F7F3EF", fontSize: 31, lineHeight: 36, fontWeight: "800", letterSpacing: -0.7 },
  body: { color: "#CFC5BE", fontSize: 16, lineHeight: 24 },
  bottom: { gap: 16 },
  button: { height: 56, borderRadius: 16, backgroundColor: "#F26A21", flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18 },
  buttonText: { color: "#FFFFFF", fontWeight: "800", fontSize: 15 },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.65 },
  footnote: { color: "#AFA39B", fontSize: 12, lineHeight: 18, textAlign: "center", paddingHorizontal: 8 },
});
