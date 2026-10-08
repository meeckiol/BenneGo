import { useRouter } from "expo-router";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { JobCard } from "@/components/mission/job-card";
import { EmptyState, LoadingState, SectionHeading } from "@/components/ui/logitruck-ui";
import { formatMoney } from "@/lib/domain/jobs";
import { trpc } from "@/lib/trpc";

export default function HistoryScreen() {
  const router = useRouter();
  const history = trpc.driver.listJobs.useQuery({ bucket: "completed", limit: 30 }, { retry: false });
  const dashboard = trpc.driver.dashboard.useQuery(undefined, { retry: false });
  if (history.isLoading || dashboard.isLoading) return <LoadingState label="Chargement de l’historique…" />;
  return <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}><ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={history.isRefetching || dashboard.isRefetching} onRefresh={() => { void history.refetch(); void dashboard.refetch(); }} tintColor="#F26A21" />}><SectionHeading eyebrow="Synthèse" title="Historique" /><View style={styles.summary}><View><View style={styles.bar} /><View style={styles.dot} /></View><View style={styles.summaryCopy}><View style={styles.totalRow}><View><View style={styles.totalLabel}><SectionHeading title={formatMoney(dashboard.data?.metrics.totalEarnings ?? 0)} /></View></View></View></View></View><View style={styles.list}>{history.data?.items.length ? history.data.items.map((job) => <JobCard key={job.id} job={job} onPress={() => router.push(`/mission/${job.id}` as never)} />) : <EmptyState icon="history" title="Pas encore de course validée" body="Les missions finalisées apparaîtront ici avec leur gain indicatif." />}</View></ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: "#F7F3EF" }, content: { padding: 18, gap: 16, paddingBottom: 28 }, summary: { backgroundColor: "#1D2924", borderRadius: 18, padding: 18, minHeight: 105, flexDirection: "row", gap: 14, overflow: "hidden" }, bar: { width: 4, height: 74, borderRadius: 4, backgroundColor: "#F26A21" }, dot: { width: 11, height: 11, borderRadius: 6, backgroundColor: "#FDD1B4", marginLeft: -4, marginTop: -43 }, summaryCopy: { justifyContent: "center" }, totalRow: { flexDirection: "row" }, totalLabel: { transform: [{ scale: 0.95 }], transformOrigin: "left" }, list: { gap: 11 } });
