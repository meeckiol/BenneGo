import { StyleSheet, Text, View } from "react-native";
import { JOB_STATUS_LABELS, type JobStatus } from "@/shared/logitruck";

const STEPS: JobStatus[] = ["accepted", "en_route_pickup", "loading", "en_route_delivery", "delivered", "validated"];

export function JobTimeline({ status }: { status: JobStatus }) {
  const activeIndex = Math.max(0, STEPS.indexOf(status));
  return (
    <View style={styles.list}>
      {STEPS.map((step, index) => {
        const complete = index <= activeIndex && status !== "cancelled";
        const current = index === activeIndex && status !== "validated";
        return (
          <View key={step} style={styles.row}>
            <View style={styles.track}>
              <View style={[styles.dot, complete && styles.dotComplete, current && styles.dotCurrent]} />
              {index < STEPS.length - 1 && <View style={[styles.line, index < activeIndex && styles.lineComplete]} />}
            </View>
            <Text style={[styles.label, complete && styles.labelComplete]}>{JOB_STATUS_LABELS[step]}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 0 },
  row: { flexDirection: "row", minHeight: 31, alignItems: "flex-start" },
  track: { width: 25, alignItems: "center", height: 31 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#DDD6D0", borderWidth: 2, borderColor: "#DDD6D0", zIndex: 1 },
  dotComplete: { backgroundColor: "#F26A21", borderColor: "#F26A21" },
  dotCurrent: { shadowColor: "#F26A21", shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  line: { position: "absolute", top: 10, width: 2, height: 23, backgroundColor: "#DDD6D0" },
  lineComplete: { backgroundColor: "#F26A21" },
  label: { color: "#8B817A", fontSize: 13, paddingLeft: 5, marginTop: -3 },
  labelComplete: { color: "#302922", fontWeight: "700" },
});
