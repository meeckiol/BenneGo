import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toJob, type JobLike } from "@/lib/domain/jobs";
import { useAuth } from "@/hooks/use-auth";
import { isActiveJobStatus, type JobStatus } from "@/shared/bennego";

export type JobBucket = "offered" | "active" | "completed";

/**
 * Réponse étendue de /drivers/me/summary.
 * Inclut désormais les données de profil camion (truck_plate, truck_type, etc.)
 * pour éviter un second appel à /auth/me.
 */
type Summary = {
  is_available: boolean;
  rating: number | null;
  rating_count: number;
  total_trips: number;
  earnings: { paid: number; pending_payout: number; awaiting_confirmation: number };
  // Profil camion
  truck_plate: string | null;
  truck_type: string | null;
  truck_capacity_m3: number | null;
  momo_provider: string | null;
  has_momo: boolean;
};

/**
 * Courses visibles du chauffeur : celles à prendre (déjà payées) + les siennes.
 *
 * Optimisation batterie/connexion :
 * - Aucun polling : les invalidations viennent de useSocket (new_order / order_taken /
 *   order_status). Fallback : staleTime 30s + pull-to-refresh manuel.
 */
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
    // Aucun polling : Socket.IO invalide les queries au bon moment.
    // staleTime de 30s évite les refetch inutiles lors de navigations entre onglets.
    staleTime: 30_000,
  });
}

export function useJob(id: string | undefined) {
  return useQuery({
    queryKey: ["job", id],
    enabled: !!id,
    queryFn: async () => toJob((await api.get(`/orders/${id}`)).data.order),
    // Pas de refetchInterval : le statut ne change que sur action chauffeur ou
    // confirmation client (à venir via Socket.IO).
    // Refetch explicite après chaque action dans MissionDetailScreen.
    staleTime: 30_000,
  });
}

export function useDriverDashboard() {
  const qc = useQueryClient();
  const { user } = useAuth();

  const dashboard = useQuery({
    queryKey: ["dashboard", user?.id],
    queryFn: async () => {
      // Un seul appel réseau au lieu de deux (/auth/me + /drivers/me/summary).
      // /drivers/me/summary a été étendu pour inclure truck_plate, truck_type, etc.
      const [summary, orders] = await Promise.all([
        api.get<Summary>("/drivers/me/summary"),
        api.get("/orders", { params: { limit: 100 } }),
      ]);

      if (!summary.data.truck_plate) {
        throw new Error(
          "Complétez votre profil camion (plaque, permis, Mobile Money) pour recevoir des courses.",
        );
      }

      const jobs: JobLike[] = orders.data.orders.map(toJob);
      return {
        profile: {
          isAvailable: summary.data.is_available,
          truckPlate: summary.data.truck_plate,
          truckType: summary.data.truck_type,
          capacityM3: summary.data.truck_capacity_m3,
          momoProvider: summary.data.momo_provider,
          hasMomo: summary.data.has_momo,
        },
        activeJob:
          jobs.find((j) => j.driverId === user?.id && isActiveJobStatus(j.status)) ?? null,
        metrics: {
          validatedTrips: summary.data.total_trips,
          rating: summary.data.rating,
          ratingCount: summary.data.rating_count,
          paid: summary.data.earnings.paid,
          pending:
            summary.data.earnings.pending_payout + summary.data.earnings.awaiting_confirmation,
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
    mutationFn: (available: boolean) =>
      api.patch("/drivers/availability", { is_available: available }),
  });
  const acceptMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/orders/${id}/accept`),
  });
  const advanceMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: JobStatus }) =>
      api.patch(`/orders/${id}/status`, { status }),
  });
  const locationMutation = useMutation({
    mutationFn: ({ jobId, latitude, longitude }: { jobId: string; latitude: number; longitude: number }) =>
      api.patch("/drivers/location", { lat: latitude, lng: longitude, order_id: jobId }),
  });

  return {
    dashboard,
    refresh,
    isWorking:
      setAvailabilityMutation.isPending ||
      acceptMutation.isPending ||
      advanceMutation.isPending ||
      locationMutation.isPending,
    setAvailability: async (available: boolean) => {
      await setAvailabilityMutation.mutateAsync(available);
      await refresh();
    },
    acceptJob: async (id: string) => {
      await acceptMutation.mutateAsync(id);
      await refresh();
    },
    advanceJob: async (id: string, status: JobStatus) => {
      await advanceMutation.mutateAsync({ id, status });
      await refresh();
    },
    recordLocation: (jobId: string, latitude: number, longitude: number) =>
      locationMutation.mutateAsync({ jobId, latitude, longitude }),
  };
}
