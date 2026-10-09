import {
  JOB_STATUS_ACTIONS,
  JOB_STATUS_LABELS,
  NEXT_JOB_STATUS,
  type JobStatus,
} from "@/shared/logitruck";

/** Course telle que renvoyée par l'API, normalisée pour l'interface. */
export type JobLike = {
  id: string;
  reference: string;
  clientName: string;
  clientPhone?: string | null;
  driverId?: string | null;
  pickupAddress: string;
  deliveryAddress: string;
  pickupLatitude: number;
  pickupLongitude: number;
  deliveryLatitude: number;
  deliveryLongitude: number;
  materialDescription: string;
  quantityM3: number;
  driverEarnings: number;
  status: JobStatus;
  paymentStatus: string;
  rating?: number | null;
  updatedAt?: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toJob(o: any): JobLike {
  return {
    id: o.id,
    reference: o.order_number,
    clientName: o.client_name ?? "Client",
    clientPhone: o.client_phone ?? null,
    driverId: o.driver_id ?? null,
    pickupAddress: o.pickup_address,
    deliveryAddress: o.delivery_address,
    pickupLatitude: Number(o.pickup_lat),
    pickupLongitude: Number(o.pickup_lng),
    deliveryLatitude: Number(o.delivery_lat),
    deliveryLongitude: Number(o.delivery_lng),
    materialDescription: o.material_description || o.material_name || "Matériaux",
    quantityM3: Number(o.quantity_m3),
    driverEarnings: Number(o.driver_amount),
    status: o.status,
    paymentStatus: o.payment_status,
    rating: o.client_rating ?? null,
    updatedAt: o.updated_at,
  };
}

export function formatMoney(value: number) {
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value)} FCFA`;
}

export function formatVolume(value: number | string) {
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(Number(value))} m³`;
}

export function formatShortDate(value?: Date | string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export function statusLabel(status: JobStatus) {
  return JOB_STATUS_LABELS[status];
}

export function nextStatus(status: JobStatus) {
  return NEXT_JOB_STATUS[status] ?? null;
}

export function nextActionLabel(status: JobStatus) {
  return JOB_STATUS_ACTIONS[status] ?? null;
}

export function statusColor(status: JobStatus) {
  if (status === "completed" || status === "validated") return "#15803D";
  if (status === "cancelled") return "#B91C1C";
  if (status === "pending") return "#B45309";
  return "#F26A21";
}

/** Message de paiement pour le chauffeur, fidèle au flux de séquestre. */
export function payoutMessage(job: Pick<JobLike, "status" | "paymentStatus" | "driverEarnings">) {
  const amount = formatMoney(job.driverEarnings);
  if (job.paymentStatus === "released") return `Payé : ${amount} versés sur votre Mobile Money.`;
  if (job.paymentStatus === "payout_pending") return `Le client a confirmé. ${amount} vous seront versés très prochainement.`;
  if (job.status === "delivered") return `Livraison enregistrée. Dès que le client confirme la réception, vos ${amount} vous sont versés.`;
  if (job.paymentStatus === "escrow_held") return `Le client a déjà payé : ${amount} sont bloqués en sécurité pour vous jusqu'à la livraison.`;
  return "";
}
