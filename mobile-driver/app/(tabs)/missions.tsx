import { useState } from "react";
import { useRouter } from "expo-router";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { JobCard } from "@/components/mission/job-card";
import { EmptyState, InfoBanner, LoadingState, SectionHeading } from "@/components/ui/bennego-ui";
import { useJobs, type JobBucket } from "@/hooks/use-driver-dashboard";

type Bucket = JobBucket;
const FILTERS: { id: Bucket; label: string }[] = [{ id: "offered", label: "À prendre" }, { id: "active", label: "En cours" }, { id: "completed", label: "Terminées" }];

export default function MissionsScreen() {
  const router = useRouter();
  const [bucket, setBucket] = useState<Bucket>("offered");
  const query = useJobs(bucket);
  if (query.isLoading) return <LoadingState label="Chargement des missions…" />;
  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} tintColor="#F26A21" />}>
        <SectionHeading eyebrow="Opérations" title="Missions" />
        <InfoBanner icon="touch-app" tone="neutral">Ces missions sont déjà payées par les clients (argent bloqué en sécurité). Acceptez uniquement si vous pouvez les réaliser.</InfoBanner>
        <View style={styles.filters}>{FILTERS.map((filter) => <Pressable key={filter.id} onPress={() => setBucket(filter.id)} style={[styles.filter, bucket === filter.id && styles.filterActive]}><Text style={[styles.filterText, bucket === filter.id && styles.filterTextActive]}>{filter.label}</Text></Pressable>)}</View>
        {query.isError ? <EmptyState icon="lock-outline" title="Accès chauffeur requis" body={query.error.message} /> : query.data?.length ? <View style={styles.list}>{query.data.map((job) => <JobCard key={job.id} job={job} onPress={() => router.push(`/mission/${job.id}` as never)} />)}</View> : <EmptyState icon={bucket === "offered" ? "route" : "inventory-2"} title={bucket === "offered" ? "Aucune mission à prendre" : "Aucune mission dans cette vue"} body={bucket === "offered" ? "Actualisez cette page lorsque vous êtes en ligne." : "Les missions apparaîtront ici au fil de leur progression."} />}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: "#F7F3EF" }, content: { padding: 18, gap: 16, paddingBottom: 28 }, filters: { flexDirection: "row", backgroundColor: "#ECE7E2", padding: 4, borderRadius: 13, gap: 3 }, filter: { flex: 1, alignItems: "center", paddingVertical: 9, borderRadius: 10 }, filterActive: { backgroundColor: "#FFFFFF" }, filterText: { color: "#746A62", fontSize: 12, fontWeight: "700" }, filterTextActive: { color: "#B94D10", fontWeight: "900" }, list: { gap: 11 } });
