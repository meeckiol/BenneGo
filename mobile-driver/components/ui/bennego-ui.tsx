import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

export function SectionHeading({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: string }) {
  return (
    <View style={styles.headingRow}>
      <View>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.heading}>{title}</Text>
      </View>
      {action ? <Text style={styles.action}>{action}</Text> : null}
    </View>
  );
}

export function InfoBanner({ icon = "info-outline", tone = "neutral", children }: { icon?: React.ComponentProps<typeof MaterialIcons>["name"]; tone?: "neutral" | "warning" | "success"; children: string }) {
  const palette = tone === "warning" ? { bg: "#FFF4E8", color: "#A94C07" } : tone === "success" ? { bg: "#EAF7EE", color: "#19703B" } : { bg: "#F2F0EE", color: "#5D554E" };
  return (
    <View style={[styles.banner, { backgroundColor: palette.bg }]}>
      <MaterialIcons name={icon} size={18} color={palette.color} />
      <Text style={[styles.bannerText, { color: palette.color }]}>{children}</Text>
    </View>
  );
}

export function EmptyState({ icon = "local-shipping", title, body }: { icon?: React.ComponentProps<typeof MaterialIcons>["name"]; title: string; body: string }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}><MaterialIcons name={icon} size={28} color="#F26A21" /></View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
    </View>
  );
}

export function LoadingState({ label = "Chargement…" }: { label?: string }) {
  return <View style={styles.loading}><ActivityIndicator color="#F26A21" /><Text style={styles.loadingText}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  headingRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  eyebrow: { color: "#A75B2A", fontSize: 11, letterSpacing: 1.1, textTransform: "uppercase", fontWeight: "800", marginBottom: 3 },
  heading: { color: "#211B16", fontSize: 22, fontWeight: "800", letterSpacing: -0.35 },
  action: { color: "#C45616", fontSize: 13, fontWeight: "800" },
  banner: { flexDirection: "row", gap: 9, paddingHorizontal: 12, paddingVertical: 11, borderRadius: 12, alignItems: "flex-start" },
  bannerText: { flex: 1, fontSize: 13, lineHeight: 19, fontWeight: "600" },
  empty: { alignItems: "center", paddingHorizontal: 28, paddingVertical: 38, gap: 8 },
  emptyIcon: { width: 58, height: 58, borderRadius: 18, backgroundColor: "#FFF0E7", alignItems: "center", justifyContent: "center", marginBottom: 4 },
  emptyTitle: { color: "#2D251E", fontSize: 17, fontWeight: "800", textAlign: "center" },
  emptyBody: { color: "#766D66", fontSize: 13, lineHeight: 19, textAlign: "center" },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 28 },
  loadingText: { color: "#6E655E", fontSize: 14 },
});
