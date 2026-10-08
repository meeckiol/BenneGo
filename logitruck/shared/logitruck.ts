export const JOB_STATUSES = [
  "offered",
  "accepted",
  "en_route_pickup",
  "loading",
  "en_route_delivery",
  "delivered",
  "validated",
  "cancelled",
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

export const ACTIVE_JOB_STATUSES = [
  "accepted",
  "en_route_pickup",
  "loading",
  "en_route_delivery",
  "delivered",
] as const satisfies readonly JobStatus[];

export const TERMINAL_JOB_STATUSES = ["validated", "cancelled"] as const satisfies readonly JobStatus[];

export const NEXT_JOB_STATUS: Record<JobStatus, JobStatus | null> = {
  offered: "accepted",
  accepted: "en_route_pickup",
  en_route_pickup: "loading",
  loading: "en_route_delivery",
  en_route_delivery: "delivered",
  delivered: "validated",
  validated: null,
  cancelled: null,
};

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  offered: "À prendre",
  accepted: "Acceptée",
  en_route_pickup: "Vers le chargement",
  loading: "Chargement",
  en_route_delivery: "Vers la livraison",
  delivered: "Livrée",
  validated: "Validée",
  cancelled: "Annulée",
};

export const JOB_STATUS_ACTIONS: Partial<Record<JobStatus, string>> = {
  accepted: "Partir vers le chargement",
  en_route_pickup: "Confirmer le chargement",
  loading: "Partir vers la livraison",
  en_route_delivery: "Confirmer la livraison",
  delivered: "Valider la livraison",
};

export function canAdvanceJob(current: JobStatus, next: JobStatus) {
  return NEXT_JOB_STATUS[current] === next;
}

export function isActiveJobStatus(status: JobStatus) {
  return ACTIVE_JOB_STATUSES.includes(status as (typeof ACTIVE_JOB_STATUSES)[number]);
}

export function isValidCoordinate(latitude: number, longitude: number) {
  return Number.isFinite(latitude) && Number.isFinite(longitude) && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}
