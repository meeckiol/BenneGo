import { TRPCError } from "@trpc/server";
import { canAdvanceJob, isValidCoordinate, type JobStatus } from "../../shared/logitruck";

export function assertAssignedDriver(driverProfileId: number, jobDriverProfileId: number | null) {
  if (jobDriverProfileId !== driverProfileId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Cette mission n’est pas attribuée à ce chauffeur.",
    });
  }
}

export function assertAllowedTransition(current: JobStatus, next: JobStatus) {
  if (!canAdvanceJob(current, next)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Transition de mission invalide : ${current} vers ${next}.`,
    });
  }
}

export function assertValidCoordinates(latitude: number, longitude: number) {
  if (!isValidCoordinate(latitude, longitude)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Les coordonnées GPS sont hors plage.",
    });
  }
}

export function assertAvailableForAcceptance(isAvailable: boolean, hasActiveJob: boolean) {
  if (!isAvailable) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "Mettez-vous en ligne avant d’accepter une mission.",
    });
  }
  if (hasActiveJob) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "Terminez votre mission active avant d’en accepter une nouvelle.",
    });
  }
}
