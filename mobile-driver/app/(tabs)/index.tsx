import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { Alert, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { InfoBanner, LoadingState, SectionHeading } from "@/components/ui/bennego-ui";
import { formatMoney } from "@/lib/domain/jobs";
import { useDriverDashboard } from "@/hooks/use-driver-dashboard";
import { useDriverLocation } from "@/hooks/use-driver-location";

function confirmAction(title: string, message: string, onConfirm: () => void) {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [{ text: "Annuler", style: "cancel" }, { text: "Confirmer", onPress: onConfirm }]);
}

export default function HomeScreen() {
  const router = useRouter();
  const driver = useDriverDashboard();
  const location = useDriverLocation(driver.recordLocation);
  const data = driver.dashboard.data;
  const profile = data?.profile;
  const activeJob = data?.activeJob;

  const toggleAvailability = () => {
    if (!profile) return;
    if (!profile.isAvailable) {
      confirmAction("Se mettre en ligne", "La localisation de premier plan sera demandée avant d’activer votre disponibilité.", async () => {
        const granted = await location.requestForegroundAccess();
        if (granted) await driver.setAvailability(true);
      });
    } else {
      confirmAction("Se mettre hors ligne", "Vous ne recevrez plus de nouvelle mission.", () => { void driver.setAvailability(false); });
    }
  };

  if (driver.dashboard.isLoading) return <LoadingState label="Préparation du poste de conduite…" />;
  if (driver.dashboard.isError) {
    return <SafeAreaView style={styles.safe}><View style={styles.access}><MaterialIcons name="verified-user" size={36} color="#F26A21" /><Text style={styles.accessTitle}>Profil chauffeur à compléter</Text><Text style={styles.accessText}>{driver.dashboard.error.message}</Text><InfoBanner tone="warning" icon="info-outline">Renseignez votre profil camion et votre numéro Mobile Money pour recevoir des missions.</InfoBanner></View></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={driver.dashboard.isRefetching} onRefresh={() => void driver.dashboard.refetch()} tintColor="#F26A21" />}>
        <View style={styles.header}><View><Text style={styles.kicker}>POSTE DE CONDUITE</Text><Text style={styles.greeting}>Bonjour, {profile?.truckPlate ?? "chauffeur"}</Text></View><View style={styles.avatar}><MaterialIcons name="local-shipping" size={23} color="#F26A21" /></View></View>
        <View style={styles.availabilityCard}>
          <View style={styles.ringOuter}><Pressable onPress={toggleAvailability} disabled={driver.isWorking} style={[styles.ring, profile?.isAvailable ? styles.ringOnline : styles.ringOffline]}><View style={[styles.statusDot, { backgroundColor: profile?.isAvailable ? "#FFFFFF" : "#F26A21" }]} /><Text style={[styles.statusTitle, profile?.isAvailable ? styles.textLight : styles.textDark]}>{profile?.isAvailable ? "EN LIGNE" : "HORS LIGNE"}</Text><Text style={[styles.statusHint, profile?.isAvailable ? styles.hintLight : styles.hintDark]}>{profile?.isAvailable ? "Prêt à recevoir" : "Touchez pour activer"}</Text></Pressable></View>
          <Text style={styles.locationText}>{location.state === "idle" ? "La position n’est jamais partagée sans votre action." : location.message}</Text>
        </View>
        {activeJob ? <Pressable onPress={() => router.push(`/mission/${activeJob.id}` as never)} style={styles.activeCard}><View style={styles.activeTop}><Text style={styles.activeEyebrow}>MISSION EN COURS</Text><Text style={styles.activeEarnings}>{formatMoney(activeJob.driverEarnings)}</Text></View><Text style={styles.activeReference}>{activeJob.reference} · {activeJob.clientName}</Text><View style={styles.route}><MaterialIcons name="trip-origin" size={16} color="#FFD5BD" /><Text style={styles.activeAddress} numberOfLines={1}>{activeJob.pickupAddress}</Text></View><View style={styles.route}><MaterialIcons name="location-on" size={16} color="#FFFFFF" /><Text style={styles.activeAddress} numberOfLines={1}>{activeJob.deliveryAddress}</Text></View><Text style={styles.manage}>Gérer la mission <MaterialIcons name="arrow-forward" size={14} color="#FFFFFF" /></Text></Pressable> : <InfoBanner icon="route" tone="neutral">Aucune mission active. Mettez-vous en ligne pour voir les missions à prendre.</InfoBanner>}
        <SectionHeading eyebrow="Synthèse" title="Cumul chauffeur" />
        <View style={styles.metrics}><Metric label="Courses confirmées" value={String(data?.metrics.validatedTrips ?? 0)} /><Metric label="Déjà versé" value={formatMoney(data?.metrics.paid ?? 0)} /></View>
        <View style={styles.metrics}><Metric label="En attente de versement" value={formatMoney(data?.metrics.pending ?? 0)} /><Metric label="Note clients" value={data?.metrics.rating ? `${data.metrics.rating.toFixed(1)}/5 (${data.metrics.ratingCount})` : "Pas encore noté"} /></View>
        <View style={styles.security}><MaterialIcons name="lock" size={18} color="#53615B" /><Text style={styles.securityText}>Le client paie avant la course : l'argent est bloqué en sécurité. Il vous est versé (90 %) dès que le client confirme la réception.</Text></View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Metric({ label, value }: { label: string; value: string }) { return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>; }

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F7F3EF" }, content: { padding: 18, gap: 18, paddingBottom: 28 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, kicker: { color: "#A45420", fontSize: 10, letterSpacing: 1.3, fontWeight: "900" }, greeting: { color: "#241D18", fontSize: 23, letterSpacing: -0.5, fontWeight: "900", marginTop: 3 }, avatar: { width: 44, height: 44, borderRadius: 14, backgroundColor: "#FFF0E7", alignItems: "center", justifyContent: "center" },
  availabilityCard: { backgroundColor: "#FFFCF9", borderRadius: 22, padding: 20, alignItems: "center", gap: 14, borderWidth: 1, borderColor: "#E9E1DB" }, ringOuter: { borderRadius: 100, padding: 9, borderWidth: 1, borderColor: "#EEE2D8" }, ring: { width: 150, height: 150, borderRadius: 80, alignItems: "center", justifyContent: "center", gap: 5 }, ringOnline: { backgroundColor: "#1B7350", shadowColor: "#1B7350", shadowOpacity: 0.25, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } }, ringOffline: { backgroundColor: "#FFF4EB" }, statusDot: { width: 10, height: 10, borderRadius: 6, marginBottom: 2 }, statusTitle: { fontWeight: "900", letterSpacing: 1.1, fontSize: 15 }, statusHint: { fontSize: 12, fontWeight: "600" }, textLight: { color: "#FFFFFF" }, textDark: { color: "#A4480D" }, hintLight: { color: "#D7F6E4" }, hintDark: { color: "#A8663F" }, locationText: { color: "#71675F", fontSize: 12, textAlign: "center", lineHeight: 17 },
  activeCard: { backgroundColor: "#F26A21", borderRadius: 20, padding: 17, gap: 8 }, activeTop: { flexDirection: "row", justifyContent: "space-between" }, activeEyebrow: { color: "#FFE0CA", fontSize: 10, letterSpacing: 1.1, fontWeight: "900" }, activeEarnings: { color: "#FFFFFF", fontSize: 16, fontWeight: "900", fontVariant: ["tabular-nums"] }, activeReference: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" }, route: { flexDirection: "row", alignItems: "center", gap: 7 }, activeAddress: { color: "#FFF7F0", fontSize: 13, flex: 1 }, manage: { color: "#FFFFFF", fontSize: 13, fontWeight: "800", textAlign: "right", marginTop: 3 },
  metrics: { flexDirection: "row", gap: 10 }, metric: { flex: 1, backgroundColor: "#FFFFFF", padding: 15, borderRadius: 16, borderWidth: 1, borderColor: "#E9E1DB", gap: 5 }, metricValue: { color: "#261E18", fontSize: 17, fontWeight: "900", fontVariant: ["tabular-nums"] }, metricLabel: { color: "#746A62", fontSize: 12, lineHeight: 16 },
  security: { flexDirection: "row", gap: 9, alignItems: "flex-start", backgroundColor: "#ECEAE6", padding: 12, borderRadius: 12 }, securityText: { color: "#5E5751", fontSize: 12, flex: 1, lineHeight: 18 },
  access: { flex: 1, padding: 28, gap: 13, justifyContent: "center", backgroundColor: "#F7F3EF" }, accessTitle: { color: "#291F18", fontSize: 25, fontWeight: "900" }, accessText: { color: "#71675F", fontSize: 15, lineHeight: 22 },
});
