import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as ImagePicker from "expo-image-picker";
import * as Linking from "expo-linking";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { JobTimeline } from "@/components/mission/job-timeline";
import { InfoBanner, LoadingState } from "@/components/ui/bennego-ui";
import {
  formatMoney,
  formatVolume,
  nextActionLabel,
  nextStatus,
  payoutMessage,
  statusColor,
  statusLabel,
} from "@/lib/domain/jobs";
import { useDriverDashboard, useJob, type BreakdownReason } from "@/hooks/use-driver-dashboard";
import { errorMessage } from "@/lib/api";
import { useDriverLocation } from "@/hooks/use-driver-location";
import { useSocket } from "@/hooks/use-socket";
import { useAuth } from "@/hooks/use-auth";
import { isActiveJobStatus, isTrackedJobStatus, type JobStatus } from "@/shared/bennego";

function notify(message: string) {
  if (Platform.OS === "web" && typeof window !== "undefined") window.alert(message);
  else Alert.alert("BenneGo", message);
}

function confirmAction(title: string, message: string, onConfirm: () => void) {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: "Annuler", style: "cancel" },
    { text: "Confirmer", onPress: onConfirm },
  ]);
}

export default function MissionDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const jobQuery = useJob(id);
  const driver = useDriverDashboard();
  const location = useDriverLocation(driver.recordLocation);
  const { isAuthenticated } = useAuth();
  const { trackOrder } = useSocket(isAuthenticated, false);
  const job = jobQuery.data;

  // ─── Chargement avant départ : volume, photos, ticket de pesée (hors rendu conditionnel) ─
  const [loadingOpen, setLoadingOpen] = useState(false);
  const [volume, setVolume] = useState("");
  const [loadingPhotos, setLoadingPhotos] = useState<string[]>([]);
  const [weighbridgeUri, setWeighbridgeUri] = useState<string | null>(null);
  const [netKg, setNetKg] = useState("");

  // ─── Rejoindre la room Socket.IO de cette commande ───────────────────────────
  // Permet de recevoir order_status en temps réel (ex. confirmation client)
  // sans avoir à poller le serveur.
  useEffect(() => {
    if (id) trackOrder(id);
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Tracking GPS automatique ────────────────────────────────────────────────
  // Démarre watchPositionAsync dès que le statut est "tracké" (accepted →
  // driver_en_route_delivery). S'arrête automatiquement à "delivered" ou au
  // démontage du composant (ex. le chauffeur quitte l'écran).
  useEffect(() => {
    if (!job?.id) return;
    if (isTrackedJobStatus(job.status as JobStatus)) {
      void location.startTracking(job.id);
    } else {
      location.stopTracking();
    }
    // stopTracking est aussi appelé dans le cleanup du hook lui-même (unmount)
  }, [job?.id, job?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Chargement / erreur ─────────────────────────────────────────────────────
  if (jobQuery.isLoading) return <LoadingState label="Chargement de la mission…" />;
  if (jobQuery.isError || !job) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.error}>
          <MaterialIcons name="error-outline" size={34} color="#B14820" />
          <Text style={styles.errorTitle}>Mission indisponible</Text>
          <Text style={styles.errorText}>
            {jobQuery.error
              ? errorMessage(jobQuery.error, "Cette mission n'est pas accessible.")
              : "Cette mission n'est pas accessible."}
          </Text>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>Retour aux missions</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Données dérivées ────────────────────────────────────────────────────────
  const status = job.status as JobStatus;
  const upcoming = nextStatus(status);
  // Le départ du chargement exige le volume et les photos : sinon l'action ouvre le formulaire
  const needsLoading = status === "loading" && job.loadingVolumeM3 == null;
  const showLoadingForm = loadingOpen && status === "loading";
  const action = status === "pending"
    ? "Accepter la mission"
    : needsLoading
      ? "Enregistrer le chargement"
      : nextActionLabel(status);
  const isActive = isActiveJobStatus(status);
  const sharesPosition = isTrackedJobStatus(status);
  const destination =
    status === "accepted" || status === "driver_en_route_pickup"
      ? { address: job.pickupAddress, latitude: job.pickupLatitude, longitude: job.pickupLongitude }
      : { address: job.deliveryAddress, latitude: job.deliveryLatitude, longitude: job.deliveryLongitude };

  const openNavigation = async () => {
    const destinationQuery =
      destination.latitude && destination.longitude
        ? `${destination.latitude},${destination.longitude}`
        : destination.address;
    await Linking.openURL(
      `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destinationQuery)}`,
    );
  };

  const takePhoto = async (onTaken: (uri: string) => void) => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      notify("Autorisez l'appareil photo pour photographier le chargement.");
      return;
    }
    // Qualité réduite : chaque photo reste sous la limite de 2 Mo côté serveur
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.5 });
    if (!result.canceled && result.assets[0]) onTaken(result.assets[0].uri);
  };

  const submitLoading = async () => {
    const volumeM3 = Number(volume.replace(",", "."));
    if (!Number.isFinite(volumeM3) || volumeM3 < 0.5 || volumeM3 > 100) {
      notify("Indiquez le volume chargé, entre 0,5 et 100 m³.");
      return;
    }
    if (loadingPhotos.length === 0) {
      notify("Ajoutez au moins une photo du camion chargé.");
      return;
    }
    try {
      await driver.recordLoading(job.id, {
        volumeM3,
        photoUris: loadingPhotos,
        weighbridgeUri,
        weighbridgeNetKg: netKg ? Number(netKg) : null,
      });
      setLoadingOpen(false);
      setVolume("");
      setLoadingPhotos([]);
      setWeighbridgeUri(null);
      setNetKg("");
      await jobQuery.refetch();
    } catch (e) {
      notify(errorMessage(e));
    }
  };

  const reportBreakdown = () => {
    const send = async (reason: BreakdownReason) => {
      try {
        const { coords } = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        await driver.reportBreakdown(job.id, reason, coords.latitude, coords.longitude);
        await jobQuery.refetch();
        notify("Panne signalée. BenneGo cherche une benne de réserve.");
      } catch (e) {
        notify(errorMessage(e, "Position GPS indisponible : activez la localisation puis réessayez."));
      }
    };
    Alert.alert("Problème sur la route", "Quel est le problème ?", [
      { text: "Crevaison", onPress: () => void send("crevaison") },
      { text: "Panne moteur", onPress: () => void send("panne_moteur") },
      { text: "Accident", onPress: () => void send("accident") },
      { text: "Annuler", style: "cancel" },
    ]);
  };

  const performAction = () => {
    if (needsLoading) {
      setLoadingOpen(true);
      return;
    }
    if (status === "pending") {
      confirmAction(
        "Accepter cette mission",
        "Le client a déjà payé : son paiement est bloqué en sécurité et vous sera versé après confirmation de réception.",
        async () => {
          try {
            await driver.acceptJob(job.id);
            await jobQuery.refetch();
          } catch (e) {
            notify(errorMessage(e));
          }
        },
      );
    } else if (upcoming && action) {
      confirmAction(
        action,
        "Cette action mettra à jour la chronologie de la mission.",
        async () => {
          try {
            await driver.advanceJob(job.id, upcoming);
            await jobQuery.refetch();
          } catch (e) {
            notify(errorMessage(e));
          }
        },
      );
    }
  };

  // ─── Rendu ───────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right", "bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Navigation */}
        <View style={styles.nav}>
          <Pressable onPress={() => router.back()} style={styles.iconButton}>
            <MaterialIcons name="arrow-back" size={22} color="#2C241E" />
          </Pressable>
          <Text style={styles.navTitle}>Mission</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* En-tête statut + référence + gain */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.status, { color: statusColor(status) }]}>{statusLabel(status)}</Text>
            <Text style={styles.ref}>{job.reference}</Text>
          </View>
          <Text style={styles.earnings}>{formatMoney(job.driverEarnings)}</Text>
        </View>

        {/* Itinéraire */}
        <View style={styles.routeCard}>
          <RoutePoint icon="trip-origin" label="CHARGEMENT" address={job.pickupAddress} />
          <View style={styles.dash} />
          <RoutePoint icon="location-on" label="LIVRAISON" address={job.deliveryAddress} />
        </View>

        {/* Infos détaillées */}
        <View style={styles.infoGrid}>
          <Info label="Client" value={job.clientName} />
          <Info label="Matériau" value={job.materialDescription} />
          <Info label="Volume" value={formatVolume(job.quantityM3)} />
          <Info label="Votre gain (90 %)" value={formatMoney(job.driverEarnings)} />
        </View>

        {payoutMessage(job) ? (
          <InfoBanner icon="lock" tone="neutral">{payoutMessage(job)}</InfoBanner>
        ) : null}

        {job.disputeStatus === "open" ? (
          <InfoBanner icon="gavel" tone="warning">
            Le client a refusé la livraison. BenneGo examine le litige ; le paiement reste bloqué.
          </InfoBanner>
        ) : null}

        {job.loadingVolumeM3 != null ? (
          <InfoBanner icon="scale" tone="success">
            {`Chargement enregistré : ${formatVolume(job.loadingVolumeM3)}${job.weighbridgeNetKg ? ` · pesée ${job.weighbridgeNetKg.toLocaleString("fr-FR")} kg` : ""}`}
          </InfoBanner>
        ) : null}

        {/* Progression */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Progression</Text>
          <JobTimeline status={status} />
        </View>

        {/* Position GPS — visible uniquement pendant les statuts trackés */}
        {sharesPosition && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Position</Text>
            <InfoBanner
              icon={location.isTracking ? "gps-fixed" : "my-location"}
              tone={
                location.state === "denied" || location.state === "error" ? "warning" : "neutral"
              }
            >
              {location.message}
            </InfoBanner>
            {/* Bouton de mise à jour immédiate (throttlé à 15 s dans le hook) */}
            <Pressable
              onPress={() => void location.shareCurrentLocation(job.id)}
              style={styles.locationButton}
            >
              <MaterialIcons name="near-me" size={19} color="#A4470A" />
              <Text style={styles.locationText}>Forcer une mise à jour de position</Text>
            </Pressable>
          </View>
        )}

        {/* Navigation externe */}
        <Pressable onPress={() => void openNavigation()} style={styles.navigateButton}>
          <MaterialIcons name="navigation" size={20} color="#3C2A1F" />
          <Text style={styles.navigateText}>Ouvrir la navigation</Text>
        </Pressable>

        {/* Action principale : formulaire de chargement, ou statut suivant */}
        {showLoadingForm ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Chargement avant départ</Text>
            <Text style={styles.formHint}>
              {"Le départ n'est possible qu'après le volume et au moins une photo du camion chargé."}
            </Text>
            <Text style={styles.fieldLabel}>Volume chargé (m³)</Text>
            <TextInput
              value={volume}
              onChangeText={setVolume}
              keyboardType="decimal-pad"
              placeholder="ex. 10"
              placeholderTextColor="#8A7F76"
              style={styles.input}
            />
            <Pressable
              onPress={() => void takePhoto((uri) => setLoadingPhotos((photos) => [...photos, uri].slice(0, 5)))}
              style={styles.photoButton}
            >
              <MaterialIcons name="photo-camera" size={19} color="#A4470A" />
              <Text style={styles.locationText}>{`Photo du camion chargé (${loadingPhotos.length}/5)`}</Text>
            </Pressable>
            <Pressable onPress={() => void takePhoto(setWeighbridgeUri)} style={styles.photoButton}>
              <MaterialIcons name="receipt-long" size={19} color="#A4470A" />
              <Text style={styles.locationText}>
                {weighbridgeUri ? "Ticket de pesée ajouté" : "Ticket de pesée (facultatif)"}
              </Text>
            </Pressable>
            <Text style={styles.fieldLabel}>Poids net du ticket (kg, facultatif)</Text>
            <TextInput
              value={netKg}
              onChangeText={setNetKg}
              keyboardType="number-pad"
              placeholder="ex. 14200"
              placeholderTextColor="#8A7F76"
              style={styles.input}
            />
            <Pressable
              onPress={() => void submitLoading()}
              disabled={driver.isWorking}
              style={[styles.primaryAction, driver.isWorking && styles.disabled]}
            >
              <Text style={styles.primaryText}>{driver.isWorking ? "Envoi…" : "Enregistrer le chargement"}</Text>
              <MaterialIcons name="check" size={20} color="#FFFFFF" />
            </Pressable>
          </View>
        ) : action ? (
          <Pressable
            onPress={performAction}
            disabled={driver.isWorking}
            style={[styles.primaryAction, driver.isWorking && styles.disabled]}
          >
            <Text style={styles.primaryText}>
              {driver.isWorking ? "Mise à jour…" : action}
            </Text>
            <MaterialIcons name="arrow-forward" size={20} color="#FFFFFF" />
          </Pressable>
        ) : (
          <InfoBanner
            icon={job.paymentStatus === "released" ? "check-circle" : "hourglass-top"}
            tone={job.paymentStatus === "released" ? "success" : "neutral"}
          >
            {payoutMessage(job) || "Aucune action chauffeur disponible."}
          </InfoBanner>
        )}

        {/* Panne ou crevaison : signalable pendant toute la course */}
        {sharesPosition && !showLoadingForm ? (
          <Pressable onPress={reportBreakdown} style={styles.breakdownButton}>
            <MaterialIcons name="warning-amber" size={19} color="#A94C07" />
            <Text style={styles.breakdownText}>Signaler une panne ou une crevaison</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Sous-composants ─────────────────────────────────────────────────────────

function RoutePoint({
  icon,
  label,
  address,
}: {
  icon: React.ComponentProps<typeof MaterialIcons>["name"];
  label: string;
  address: string;
}) {
  return (
    <View style={styles.routePoint}>
      <MaterialIcons
        name={icon}
        size={21}
        color={icon === "location-on" ? "#F26A21" : "#5A6E65"}
      />
      <View style={{ flex: 1 }}>
        <Text style={styles.routeLabel}>{label}</Text>
        <Text style={styles.address}>{address}</Text>
      </View>
    </View>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.info}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F7F3EF" },
  content: { padding: 18, gap: 16, paddingBottom: 24 },
  nav: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  navTitle: { color: "#2B231D", fontWeight: "900", fontSize: 16 },
  iconButton: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: "#FFFFFF",
    alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#E9E1DB",
  },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  status: { fontSize: 12, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.9 },
  ref: { color: "#342A23", fontWeight: "900", fontSize: 22, marginTop: 4 },
  earnings: { color: "#232018", fontSize: 17, fontWeight: "900", fontVariant: ["tabular-nums"] },
  routeCard: {
    backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E9E1DB",
    borderRadius: 18, padding: 16, gap: 10,
  },
  routePoint: { flexDirection: "row", alignItems: "flex-start", gap: 11 },
  routeLabel: { color: "#947F70", fontSize: 10, fontWeight: "900", letterSpacing: 0.9 },
  address: { color: "#2B241E", fontSize: 14, fontWeight: "700", marginTop: 3, lineHeight: 20 },
  dash: { height: 10, borderLeftWidth: 1, borderStyle: "dashed", borderColor: "#D4CBC4", marginLeft: 10 },
  infoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  info: { width: "48.7%", backgroundColor: "#ECE7E2", borderRadius: 14, padding: 13, gap: 3 },
  infoLabel: { color: "#7B7068", fontSize: 11 },
  infoValue: { color: "#30261F", fontSize: 13, fontWeight: "800", lineHeight: 18 },
  section: {
    backgroundColor: "#FFFFFF", borderRadius: 18, padding: 16, gap: 13,
    borderWidth: 1, borderColor: "#E9E1DB",
  },
  sectionTitle: { color: "#2B231D", fontSize: 16, fontWeight: "900" },
  locationButton: {
    alignItems: "center", flexDirection: "row", justifyContent: "center",
    gap: 7, paddingVertical: 11, borderRadius: 10, backgroundColor: "#FFF1E8",
  },
  locationText: { color: "#A4470A", fontSize: 13, fontWeight: "800" },
  navigateButton: {
    minHeight: 51, borderRadius: 15, borderWidth: 1, borderColor: "#D8CDC3",
    flexDirection: "row", gap: 9, alignItems: "center", justifyContent: "center",
    backgroundColor: "#FFFDFB",
  },
  navigateText: { color: "#3C2A1F", fontWeight: "900", fontSize: 14 },
  primaryAction: {
    minHeight: 55, borderRadius: 16, paddingHorizontal: 18,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: "#F26A21",
  },
  primaryText: { color: "#FFFFFF", fontSize: 15, fontWeight: "900" },
  disabled: { opacity: 0.62 },
  error: { flex: 1, padding: 28, backgroundColor: "#F7F3EF", justifyContent: "center", gap: 12 },
  errorTitle: { color: "#2B231D", fontSize: 24, fontWeight: "900" },
  errorText: { color: "#71675F", fontSize: 14, lineHeight: 21 },
  backButton: {
    marginTop: 5, alignSelf: "flex-start", backgroundColor: "#FFFFFF",
    paddingHorizontal: 16, paddingVertical: 11, borderRadius: 12,
  },
  backText: { color: "#A4470A", fontWeight: "800" },
  formHint: { color: "#71675F", fontSize: 13, lineHeight: 19 },
  fieldLabel: { color: "#5D554E", fontSize: 12, fontWeight: "800" },
  input: {
    borderWidth: 1, borderColor: "#D8CDC3", borderRadius: 12, backgroundColor: "#FFFDFB",
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: "#2B241E",
  },
  photoButton: {
    alignItems: "center", flexDirection: "row", gap: 9, paddingVertical: 12,
    paddingHorizontal: 14, borderRadius: 12, backgroundColor: "#FFF1E8",
  },
  breakdownButton: {
    minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: "#F3C9A8",
    flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  breakdownText: { color: "#A94C07", fontWeight: "800", fontSize: 14 },
});
