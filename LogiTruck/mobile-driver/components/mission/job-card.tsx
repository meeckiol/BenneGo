import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { formatMoney, formatVolume, statusColor, statusLabel, type JobLike } from "@/lib/domain/jobs";

export function JobCard({ job, onPress }: { job: JobLike; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]} accessibilityRole="button">
      <View style={styles.topline}>
        <View style={[styles.badge, { backgroundColor: `${statusColor(job.status)}18` }]}>
          <Text style={[styles.badgeText, { color: statusColor(job.status) }]}>{statusLabel(job.status)}</Text>
        </View>
        <Text style={styles.earnings}>{formatMoney(job.driverEarnings)}</Text>
      </View>
      <Text style={styles.reference}>{job.reference}</Text>
      <View style={styles.routeRow}>
        <View style={styles.routeColumn}>
          <View style={styles.originDot} />
          <View style={styles.routeLine} />
          <MaterialIcons name="location-on" size={17} color="#F26A21" />
        </View>
        <View style={styles.addresses}>
          <Text numberOfLines={1} style={styles.address}>{job.pickupAddress}</Text>
          <Text numberOfLines={1} style={styles.address}>{job.deliveryAddress}</Text>
        </View>
      </View>
      <View style={styles.footer}>
        <Text style={styles.meta}>{job.clientName}</Text>
        <Text style={styles.meta}>{job.materialDescription} · {formatVolume(job.quantityM3)}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#FFFFFF", borderRadius: 18, padding: 16, gap: 8, borderWidth: 1, borderColor: "#E8E3DF" },
  pressed: { opacity: 0.82, transform: [{ scale: 0.992 }] },
  topline: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontWeight: "800", letterSpacing: 0.35, textTransform: "uppercase" },
  earnings: { color: "#17201D", fontSize: 16, fontWeight: "800", fontVariant: ["tabular-nums"] },
  reference: { color: "#7A726C", fontSize: 12, fontWeight: "700", letterSpacing: 0.6 },
  routeRow: { flexDirection: "row", gap: 10, minHeight: 48 },
  routeColumn: { alignItems: "center", width: 18 },
  originDot: { width: 9, height: 9, borderRadius: 5, borderWidth: 2, borderColor: "#F26A21", marginTop: 4 },
  routeLine: { flex: 1, width: 1, borderLeftWidth: 1, borderStyle: "dashed", borderColor: "#D9D0C8", marginVertical: 2 },
  addresses: { flex: 1, justifyContent: "space-between", gap: 8 },
  address: { color: "#27211D", fontSize: 14, fontWeight: "600" },
  footer: { flexDirection: "row", justifyContent: "space-between", gap: 8, borderTopWidth: 1, borderTopColor: "#F3EEEA", paddingTop: 10 },
  meta: { color: "#756D67", fontSize: 12, flexShrink: 1 },
});
