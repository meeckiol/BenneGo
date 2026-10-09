import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toJob, type JobLike } from "@/lib/domain/jobs";
import { useAuth } from "@/hooks/use-auth";
import { isActiveJobStatus, type JobStatus } from "@/shared/logitruck";

export type JobBucket = "offered" | "active" | "completed";

type Summary = {
  is_available: boolean;
  rating: number | null;
  rating_count: number;
  total_trips: number;
  earnings: { paid: number; pending_payout: number; awaiting_confirmation: number };
};

/** Courses visibles du chauffeur : celles à prendre (déjà payées par les clients) + les siennes. */
export function useJobs(bucket: JobBucket) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["jobs", bucket, user?.id],
    queryFn: async () => {
      const { data } = await api.get("/orders", { params: { limit: 100 } });
      const jobs: JobLike[] = data.orders.map(toJob);
      const mine = jobs.filter((j) => j.driverId === user?.id);
      if (bucket === "offered") return jobs.filter((j) => j.status === "pending" && !j.driverId);
      if (bucket === "active") return mine.filter((j) => isActiveJobStatus(j.status));
      return mine.filter((j) => j.status === "validated" || j.status === "completed");
    },
    refetchInterval: bucket === "offered" ? 15000 : false,
  });
}

export function useJob(id: string | undefined) {
  return useQuery({
    queryKey: ["job", id],
    enabled: !!id,
    queryFn: async () => toJob((await api.get(`/orders/${id}`)).data.order),
    refetchInterval: 10000, // le statut peut changer côté client (confirmation de réception)
  });
}

export function useDriverDashboard() {
  const qc = useQueryClient();
  const { user } = useAuth();

  const dashboard = useQuery({
    queryKey: ["dashboard", user?.id],
    queryFn: async () => {
      const [me, summary, orders] = await Promise.all([
        api.get("/auth/me"),
        api.get<Summary>("/drivers/me/summary"),
        api.get("/orders", { params: { limit: 100 } }),
      ]);
      const u = me.data.user;
      if (!u.truck_plate) throw new Error("Complétez votre profil camion (plaque, permis, Mobile Money) pour recevoir des courses.");
      const jobs: JobLike[] = orders.data.orders.map(toJob);
      return {
        profile: {
          isAvailable: summary.data.is_available,
          truckPlate: u.truck_plate as string,
          truckType: u.truck_type as string | null,
          capacityM3: u.truck_capacity_m3 as number | null,
          momoProvider: u.momo_provider as string | null,
          hasMomo: !!u.momo_number,
        },
        activeJob: jobs.find((j) => j.driverId === user?.id && isActiveJobStatus(j.status)) ?? null,
        metrics: {
          validatedTrips: summary.data.total_trips,
          rating: summary.data.rating,
          ratingCount: summary.data.rating_count,
          paid: summary.data.earnings.paid,
          pending: summary.data.earnings.pending_payout + summary.data.earnings.awaiting_confirmation,
        },
      };
    },
    retry: false,
  });

  const refresh = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["dashboard"] }),
      qc.invalidateQueries({ queryKey: ["jobs"] }),
      qc.invalidateQueries({ queryKey: ["job"] }),
    ]);
  };

  const setAvailabilityMutation = useMutation({
    mutationFn: (available: boolean) => api.patch("/drivers/availability", { is_available: available }),
  });
  const acceptMutation = useMutation({ mutationFn: (id: string) => api.patch(`/orders/${id}/accept`) });
  const advanceMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: JobStatus }) => api.patch(`/orders/${id}/status`, { status }),
  });
  const locationMutation = useMutation({
    mutationFn: ({ jobId, latitude, longitude }: { jobId: string; latitude: number; longitude: number }) =>
      api.patch("/drivers/location", { lat: latitude, lng: longitude, order_id: jobId }),
  });

  return {
    dashboard,
    refresh,
    isWorking: setAvailabilityMutation.isPending || acceptMutation.isPending || advanceMutation.isPending || locationMutation.isPending,
    setAvailability: async (available: boolean) => { await setAvailabilityMutation.mutateAsync(available); await refresh(); },
    acceptJob: async (id: string) => { await acceptMutation.mutateAsync(id); await refresh(); },
    advanceJob: async (id: string, status: JobStatus) => { await advanceMutation.mutateAsync({ id, status }); await refresh(); },
    recordLocation: (jobId: string, latitude: number, longitude: number) =>
      locationMutation.mutateAsync({ jobId, latitude, longitude }),
  };
}
