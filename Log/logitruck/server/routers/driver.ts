import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, isNull, lt } from "drizzle-orm";
import { z } from "zod";
import { driverProfiles, jobEvents, jobLocations, jobs } from "../../drizzle/schema";
import {
  ACTIVE_JOB_STATUSES,
  JOB_STATUSES,
  TERMINAL_JOB_STATUSES,
  isActiveJobStatus,
  type JobStatus,
} from "../../shared/logitruck";
import { getDb } from "../db";
import { protectedProcedure, router } from "../_core/trpc";
import {
  assertAllowedTransition,
  assertAssignedDriver,
  assertAvailableForAcceptance,
  assertValidCoordinates,
} from "../services/driver-guards";

const nextStatusSchema = z.enum(["en_route_pickup", "loading", "en_route_delivery", "delivered", "validated"]);

async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "La base de données est indisponible." });
  return db;
}

async function requireActiveDriver(userId: number) {
  const db = await requireDb();
  const [profile] = await db.select().from(driverProfiles).where(eq(driverProfiles.userId, userId)).limit(1);
  if (!profile || profile.status !== "active") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Le profil chauffeur n’est pas activé. Contactez les opérations LogiTruck." });
  }
  return { db, profile };
}

async function lockActiveDriver(tx: any, userId: number) {
  const [profile] = await tx
    .select()
    .from(driverProfiles)
    .where(eq(driverProfiles.userId, userId))
    .for("update")
    .limit(1);
  if (!profile || profile.status !== "active") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Le profil chauffeur n’est pas activé." });
  }
  return profile;
}

function paginate<T extends { id: number }>(items: T[], limit: number) {
  const page = items.slice(0, limit);
  return { items: page, nextCursor: items.length > limit ? page.at(-1)?.id ?? null : null };
}

function isDuplicateKeyError(error: unknown) {
  if (typeof error !== "object" || error === null) return false;
  const candidate = error as { code?: string; errno?: number };
  return candidate.code === "ER_DUP_ENTRY" || candidate.errno === 1062;
}

async function getReplayJob(tx: any, requestId: string, actorUserId: number) {
  const [event] = await tx
    .select({ jobId: jobEvents.jobId, actorUserId: jobEvents.actorUserId })
    .from(jobEvents)
    .where(eq(jobEvents.requestId, requestId))
    .limit(1);
  if (!event) return null;
  if (event.actorUserId !== actorUserId) {
    throw new TRPCError({ code: "CONFLICT", message: "Cette clé d’idempotence appartient à une autre action." });
  }
  const [job] = await tx.select().from(jobs).where(eq(jobs.id, event.jobId)).limit(1);
  if (!job) throw new TRPCError({ code: "NOT_FOUND", message: "Mission introuvable." });
  return job;
}

async function reserveEvent(
  tx: any,
  values: { jobId: number; actorUserId: number; eventType: string; requestId: string; metadata: Record<string, unknown> },
) {
  try {
    await tx.insert(jobEvents).values(values);
    return null;
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;
    return getReplayJob(tx, values.requestId, values.actorUserId);
  }
}

export const driverRouter = router({
  dashboard: protectedProcedure.query(async ({ ctx }) => {
    const { db, profile } = await requireActiveDriver(ctx.user.id);
    const activeJobs = await db
      .select()
      .from(jobs)
      .where(and(eq(jobs.driverProfileId, profile.id), inArray(jobs.status, ACTIVE_JOB_STATUSES)))
      .orderBy(desc(jobs.updatedAt))
      .limit(1);
    const validatedJobs = await db
      .select({ id: jobs.id, earnings: jobs.driverEarnings })
      .from(jobs)
      .where(and(eq(jobs.driverProfileId, profile.id), eq(jobs.status, "validated")));
    return {
      profile,
      activeJob: activeJobs[0] ?? null,
      metrics: {
        validatedTrips: validatedJobs.length,
        totalEarnings: validatedJobs.reduce((total, job) => total + job.earnings, 0),
      },
    };
  }),

  listJobs: protectedProcedure
    .input(z.object({ bucket: z.enum(["offered", "active", "completed"]), limit: z.number().int().min(1).max(30).default(15), cursor: z.number().int().positive().optional() }))
    .query(async ({ ctx, input }) => {
      const { db, profile } = await requireActiveDriver(ctx.user.id);
      const cursorCondition = input.cursor ? lt(jobs.id, input.cursor) : undefined;
      const limit = input.limit + 1;
      let rows;
      if (input.bucket === "offered") {
        rows = await db.select().from(jobs).where(and(eq(jobs.status, "offered"), isNull(jobs.driverProfileId), cursorCondition)).orderBy(desc(jobs.createdAt), desc(jobs.id)).limit(limit);
      } else if (input.bucket === "active") {
        rows = await db.select().from(jobs).where(and(eq(jobs.driverProfileId, profile.id), inArray(jobs.status, ACTIVE_JOB_STATUSES), cursorCondition)).orderBy(desc(jobs.updatedAt), desc(jobs.id)).limit(limit);
      } else {
        rows = await db.select().from(jobs).where(and(eq(jobs.driverProfileId, profile.id), inArray(jobs.status, TERMINAL_JOB_STATUSES), cursorCondition)).orderBy(desc(jobs.updatedAt), desc(jobs.id)).limit(limit);
      }
      return paginate(rows, input.limit);
    }),

  getJob: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ ctx, input }) => {
    const { db, profile } = await requireActiveDriver(ctx.user.id);
    const [job] = await db.select().from(jobs).where(eq(jobs.id, input.id)).limit(1);
    if (!job) throw new TRPCError({ code: "NOT_FOUND", message: "Mission introuvable." });
    if (job.status !== "offered") assertAssignedDriver(profile.id, job.driverProfileId);
    return job;
  }),

  setAvailability: protectedProcedure.input(z.object({ available: z.boolean() })).mutation(async ({ ctx, input }) => {
    const { db, profile } = await requireActiveDriver(ctx.user.id);
    const [activeJob] = await db.select({ id: jobs.id }).from(jobs).where(and(eq(jobs.driverProfileId, profile.id), inArray(jobs.status, ACTIVE_JOB_STATUSES))).limit(1);
    const available = input.available && !activeJob;
    await db.update(driverProfiles).set({ isAvailable: available }).where(eq(driverProfiles.id, profile.id));
    return { isAvailable: available, activeMissionLocksAvailability: Boolean(activeJob) };
  }),

  acceptJob: protectedProcedure.input(z.object({ id: z.number().int().positive(), requestId: z.string().uuid() })).mutation(async ({ ctx, input }) => {
    const { db } = await requireActiveDriver(ctx.user.id);
    return db.transaction(async (tx) => {
      const profile = await lockActiveDriver(tx, ctx.user.id);
      const replay = await getReplayJob(tx, input.requestId, ctx.user.id);
      if (replay) return replay;

      const [activeJob] = await tx.select({ id: jobs.id }).from(jobs).where(and(eq(jobs.driverProfileId, profile.id), inArray(jobs.status, ACTIVE_JOB_STATUSES))).for("update").limit(1);
      assertAvailableForAcceptance(profile.isAvailable, Boolean(activeJob));

      const [job] = await tx.select().from(jobs).where(eq(jobs.id, input.id)).for("update").limit(1);
      if (!job) throw new TRPCError({ code: "NOT_FOUND", message: "Mission introuvable." });
      if (job.status !== "offered" || job.driverProfileId !== null) {
        throw new TRPCError({ code: "CONFLICT", message: "Cette mission vient d’être attribuée à un autre chauffeur." });
      }

      const duplicate = await reserveEvent(tx, { jobId: job.id, actorUserId: ctx.user.id, eventType: "accepted", requestId: input.requestId, metadata: { from: "offered", to: "accepted" } });
      if (duplicate) return duplicate;

      await tx.update(jobs).set({ driverProfileId: profile.id, status: "accepted", acceptedAt: new Date() }).where(eq(jobs.id, job.id));
      await tx.update(driverProfiles).set({ isAvailable: false }).where(eq(driverProfiles.id, profile.id));
      const [assignedJob] = await tx.select().from(jobs).where(eq(jobs.id, job.id)).limit(1);
      if (!assignedJob) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Mission introuvable après attribution." });
      return assignedJob;
    });
  }),

  advanceJob: protectedProcedure
    .input(z.object({ id: z.number().int().positive(), nextStatus: nextStatusSchema, requestId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { db } = await requireActiveDriver(ctx.user.id);
      return db.transaction(async (tx) => {
        const profile = await lockActiveDriver(tx, ctx.user.id);
        const replay = await getReplayJob(tx, input.requestId, ctx.user.id);
        if (replay) return replay;

        const [job] = await tx.select().from(jobs).where(eq(jobs.id, input.id)).for("update").limit(1);
        if (!job) throw new TRPCError({ code: "NOT_FOUND", message: "Mission introuvable." });
        assertAssignedDriver(profile.id, job.driverProfileId);
        assertAllowedTransition(job.status as JobStatus, input.nextStatus);

        const duplicate = await reserveEvent(tx, { jobId: job.id, actorUserId: ctx.user.id, eventType: input.nextStatus, requestId: input.requestId, metadata: { from: job.status, to: input.nextStatus } });
        if (duplicate) return duplicate;

        await tx.update(jobs).set({ status: input.nextStatus, completedAt: input.nextStatus === "validated" ? new Date() : job.completedAt }).where(eq(jobs.id, job.id));
        const [updatedJob] = await tx.select().from(jobs).where(eq(jobs.id, job.id)).limit(1);
        if (!updatedJob) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Mission introuvable après mise à jour." });
        return updatedJob;
      });
    }),

  recordLocation: protectedProcedure
    .input(z.object({ jobId: z.number().int().positive(), latitude: z.number().finite().min(-90).max(90), longitude: z.number().finite().min(-180).max(180) }))
    .mutation(async ({ ctx, input }) => {
      assertValidCoordinates(input.latitude, input.longitude);
      const { db, profile } = await requireActiveDriver(ctx.user.id);
      const [job] = await db.select().from(jobs).where(eq(jobs.id, input.jobId)).limit(1);
      if (!job) throw new TRPCError({ code: "NOT_FOUND", message: "Mission introuvable." });
      assertAssignedDriver(profile.id, job.driverProfileId);
      if (!isActiveJobStatus(job.status as JobStatus)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "La position ne peut être partagée que pendant une mission active." });
      }
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);
      await db.transaction(async (tx) => {
        await tx.delete(jobLocations).where(lt(jobLocations.expiresAt, new Date()));
        await tx.insert(jobLocations).values({ jobId: job.id, driverProfileId: profile.id, latitude: input.latitude.toFixed(7), longitude: input.longitude.toFixed(7), expiresAt });
      });
      return { recorded: true, recordedAt: new Date().toISOString(), expiresAt: expiresAt.toISOString() };
    }),
});
