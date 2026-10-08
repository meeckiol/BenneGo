import { trpc } from "@/lib/trpc";
import { createRequestId } from "@/lib/domain/jobs";
import type { JobStatus } from "@/shared/logitruck";

export function useDriverDashboard() {
  const utils = trpc.useUtils();
  const dashboard = trpc.driver.dashboard.useQuery(undefined, { retry: false });
  const setAvailabilityMutation = trpc.driver.setAvailability.useMutation();
  const acceptJobMutation = trpc.driver.acceptJob.useMutation();
  const advanceJobMutation = trpc.driver.advanceJob.useMutation();
  const recordLocationMutation = trpc.driver.recordLocation.useMutation();

  const refresh = async () => {
    await Promise.all([
      utils.driver.dashboard.invalidate(),
      utils.driver.listJobs.invalidate(),
    ]);
  };

  return {
    dashboard,
    refresh,
    isWorking:
      setAvailabilityMutation.isPending ||
      acceptJobMutation.isPending ||
      advanceJobMutation.isPending ||
      recordLocationMutation.isPending,
    setAvailability: async (available: boolean) => {
      const result = await setAvailabilityMutation.mutateAsync({ available });
      await refresh();
      return result;
    },
    acceptJob: async (id: number) => {
      const result = await acceptJobMutation.mutateAsync({ id, requestId: createRequestId() });
      await refresh();
      return result;
    },
    advanceJob: async (id: number, nextStatus: JobStatus) => {
      const result = await advanceJobMutation.mutateAsync({
        id,
        nextStatus: nextStatus as "en_route_pickup" | "loading" | "en_route_delivery" | "delivered" | "validated",
        requestId: createRequestId(),
      });
      await refresh();
      return result;
    },
    recordLocation: (jobId: number, latitude: number, longitude: number) =>
      recordLocationMutation.mutateAsync({ jobId, latitude, longitude }),
  };
}
