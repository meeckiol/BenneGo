/** Statuts d'une course — identiques à ceux du backend BenneGo. */
export const JOB_STATUSES = [
  "awaiting_payment",
  "pending",
  "accepted",
  "driver_en_route_pickup",
  "loading",
  "driver_en_route_delivery",
  "machine_operating",
  "dumping",
  "delivered",
  "validated",
  "completed",
  "cancelled",
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

export type OrderType = "MATERIAL" | "RENTAL" | "EVACUATION";

/** Statuts pendant lesquels le chauffeur est en course (le suivi GPS est actif pendant les opérations). */
export const ACTIVE_JOB_STATUSES = [
  "accepted",
  "driver_en_route_pickup",
  "loading",
  "driver_en_route_delivery",
  "machine_operating",
  "dumping",
  "delivered",
] as const satisfies readonly JobStatus[];

export const TRACKED_JOB_STATUSES = [
  "accepted",
  "driver_en_route_pickup",
  "loading",
  "driver_en_route_delivery",
  "machine_operating",
  "dumping",
] as const satisfies readonly JobStatus[];

/**
 * Le chauffeur fait avancer la course jusqu'à "delivered".
 * La suite (validation, libération du paiement) appartient au CLIENT : jamais au chauffeur.
 */
export const NEXT_JOB_STATUS: Partial<Record<JobStatus, JobStatus>> = {
  accepted: "driver_en_route_pickup",
  driver_en_route_pickup: "loading",
  loading: "driver_en_route_delivery",
  driver_en_route_delivery: "delivered",
  machine_operating: "delivered",
  dumping: "delivered",
};

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  awaiting_payment: "En attente de paiement",
  pending: "À prendre",
  accepted: "Acceptée",
  driver_en_route_pickup: "Vers le site / carrière",
  loading: "Chargement en cours",
  driver_en_route_delivery: "En route vers livraison / décharge",
  machine_operating: "Engin en cours d'opération",
  dumping: "Déchargement à la décharge",
  delivered: "Terminée · en attente validation client",
  validated: "Confirmée par le client",
  completed: "Payée",
  cancelled: "Annulée",
};

export const JOB_STATUS_ACTIONS: Partial<Record<JobStatus, string>> = {
  accepted: "Partir vers le site",
  driver_en_route_pickup: "Confirmer l'arrivée sur site",
  loading: "Partir livrer / décharger",
  driver_en_route_delivery: "Confirmer la livraison / décharge",
  machine_operating: "Terminer les heures de travail",
  dumping: "Confirmer la décharge",
};

export function isActiveJobStatus(status: JobStatus) {
  return (ACTIVE_JOB_STATUSES as readonly string[]).includes(status);
}

export function isTrackedJobStatus(status: JobStatus) {
  return (TRACKED_JOB_STATUSES as readonly string[]).includes(status);
}

export function isValidCoordinate(latitude: number, longitude: number) {
  return Number.isFinite(latitude) && Number.isFinite(longitude) && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}
