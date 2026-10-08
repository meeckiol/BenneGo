import {
  JOB_STATUS_ACTIONS,
  JOB_STATUS_LABELS,
  NEXT_JOB_STATUS,
  type JobStatus,
} from "@/shared/logitruck";

export type JobLike = {
  id: number;
  reference: string;
  clientName: string;
  pickupAddress: string;
  deliveryAddress: string;
  materialDescription: string;
  quantityM3: string | number;
  driverEarnings: number;
  status: JobStatus;
  updatedAt?: Date | string;
  acceptedAt?: Date | string | null;
};

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
  return NEXT_JOB_STATUS[status];
}

export function nextActionLabel(status: JobStatus) {
  return JOB_STATUS_ACTIONS[status] ?? null;
}

export function statusColor(status: JobStatus) {
  if (status === "validated") return "#15803D";
  if (status === "cancelled") return "#B91C1C";
  if (status === "offered") return "#B45309";
  return "#F26A21";
}

export function createRequestId() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    const value = character === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}
