import { TRPCError } from "@trpc/server";
import { eq, lt } from "drizzle-orm";
import { z } from "zod";
import { driverProfiles, jobLocations, users } from "../../drizzle/schema";
import { getDb } from "../db";
import { adminProcedure, router } from "../_core/trpc";

export const operationsRouter = router({
  /** Réservé aux opérations : active ou met à jour un profil chauffeur sans mot de passe local. */
  provisionDriver: adminProcedure
    .input(
      z.object({
        userId: z.number().int().positive(),
        truckType: z.string().trim().min(2).max(80),
        truckPlate: z.string().trim().min(3).max(32),
        capacityM3: z.number().positive().max(9999).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "La base de données est indisponible." });
      const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, input.userId)).limit(1);
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "Utilisateur introuvable." });
      await db
        .insert(driverProfiles)
        .values({
          userId: user.id,
          status: "active",
          truckType: input.truckType,
          truckPlate: input.truckPlate,
          capacityM3: input.capacityM3?.toFixed(2),
          isAvailable: false,
        })
        .onDuplicateKeyUpdate({
          set: {
            status: "active",
            truckType: input.truckType,
            truckPlate: input.truckPlate,
            capacityM3: input.capacityM3?.toFixed(2),
            isAvailable: false,
          },
        });
      const [profile] = await db.select().from(driverProfiles).where(eq(driverProfiles.userId, user.id)).limit(1);
      return profile;
    }),

  /** Purge explicite des positions arrivées à expiration, réservée aux opérations. */
  purgeExpiredLocations: adminProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "La base de données est indisponible." });
    const result = await db.delete(jobLocations).where(lt(jobLocations.expiresAt, new Date()));
    return { deleted: Number((result[0] as { affectedRows?: number } | undefined)?.affectedRows ?? 0) };
  }),
});
