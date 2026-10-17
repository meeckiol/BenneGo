import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/hooks/use-auth";
import { errorMessage } from "@/lib/api";

export default function SignInScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = async () => {
    if (!phone.trim() || !password) { setError("Saisissez votre numéro et votre mot de passe."); return; }
    try {
      setLoading(true);
      setError(null);
      await login(phone, password);
      router.replace("/(tabs)" as never);
    } catch (e) {
      setError(errorMessage(e, "Connexion impossible."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom", "left", "right"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <View style={styles.logoMark}>
              <Image source={require("../../assets/images/logitruck-icon.png")} style={styles.logoImage} resizeMode="contain" />
            </View>
            <Text style={styles.wordmark}>Logi<Text style={styles.wordmarkAccent}>Truck</Text></Text>
            <Text style={styles.kicker}>DRIVER</Text>
          </View>
          <View style={styles.copy}>
            <Text style={styles.title}>Votre poste de conduite, au clair.</Text>
            <Text style={styles.body}>Courses déjà payées par les clients, paiement garanti après livraison confirmée.</Text>
          </View>
          <View style={styles.bottom}>
            <TextInput value={phone} onChangeText={setPhone} placeholder="Numéro de téléphone (+229…)" placeholderTextColor="#8E847D"
              keyboardType="phone-pad" autoComplete="tel" autoCapitalize="none" style={styles.input} accessibilityLabel="Numéro de téléphone" />
            <TextInput value={password} onChangeText={setPassword} placeholder="Mot de passe" placeholderTextColor="#8E847D"
              secureTextEntry autoComplete="password" style={styles.input} accessibilityLabel="Mot de passe" onSubmitEditing={signIn} />
            {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
            <Pressable onPress={signIn} disabled={loading} style={({ pressed }) => [styles.button, pressed && styles.pressed, loading && styles.disabled]}>
              {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Se connecter</Text>}
              <MaterialIcons name="arrow-forward" color="#FFFFFF" size={20} />
            </Pressable>
            <Text style={styles.footnote}>Compte chauffeur créé depuis l'application web LogiTruck.</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#1C2321" },
  container: { flexGrow: 1, paddingHorizontal: 26, paddingVertical: 30, justifyContent: "space-between", gap: 28 },
  input: { height: 54, borderRadius: 14, backgroundColor: "#2A3330", color: "#F7F3EF", paddingHorizontal: 16, fontSize: 16 },
  error: { color: "#FFB4A0", fontSize: 13 },
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
