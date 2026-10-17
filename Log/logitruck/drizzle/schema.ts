import {
  boolean,
  decimal,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

/** Compte synchronisé depuis Manus OAuth. */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

/** L’accès chauffeur est accordé par une procédure d’exploitation, jamais par inscription libre. */
export const driverProfiles = mysqlTable(
  "driver_profiles",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "cascade" }),
    status: mysqlEnum("status", ["pending", "active", "suspended"]).default("pending").notNull(),
    truckType: varchar("truckType", { length: 80 }),
    truckPlate: varchar("truckPlate", { length: 32 }),
    capacityM3: decimal("capacityM3", { precision: 7, scale: 2 }),
    isAvailable: boolean("isAvailable").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [index("driver_profiles_status_idx").on(table.status)],
);

/** Mission proposée par les opérations et exécutée par un chauffeur autorisé. */
export const jobs = mysqlTable(
  "jobs",
  {
    id: int("id").autoincrement().primaryKey(),
    reference: varchar("reference", { length: 40 }).notNull().unique(),
    clientName: varchar("clientName", { length: 140 }).notNull(),
    pickupAddress: text("pickupAddress").notNull(),
    deliveryAddress: text("deliveryAddress").notNull(),
    pickupLatitude: decimal("pickupLatitude", { precision: 10, scale: 7 }),
    pickupLongitude: decimal("pickupLongitude", { precision: 10, scale: 7 }),
    deliveryLatitude: decimal("deliveryLatitude", { precision: 10, scale: 7 }),
    deliveryLongitude: decimal("deliveryLongitude", { precision: 10, scale: 7 }),
    materialDescription: varchar("materialDescription", { length: 180 }).notNull(),
    quantityM3: decimal("quantityM3", { precision: 7, scale: 2 }).notNull(),
    driverEarnings: int("driverEarnings").notNull(),
    status: mysqlEnum("status", [
      "offered",
      "accepted",
      "en_route_pickup",
      "loading",
      "en_route_delivery",
      "delivered",
      "validated",
      "cancelled",
    ])
      .default("offered")
      .notNull(),
    driverProfileId: int("driverProfileId").references(() => driverProfiles.id, { onDelete: "set null" }),
    acceptedAt: timestamp("acceptedAt"),
    completedAt: timestamp("completedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    index("jobs_status_idx").on(table.status),
    index("jobs_driver_status_idx").on(table.driverProfileId, table.status),
  ],
);

/** Trace immuable des actions métier ; requestId assure l’idempotence. */
export const jobEvents = mysqlTable(
  "job_events",
  {
    id: int("id").autoincrement().primaryKey(),
    jobId: int("jobId")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    actorUserId: int("actorUserId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    eventType: varchar("eventType", { length: 48 }).notNull(),
    requestId: varchar("requestId", { length: 64 }).notNull().unique(),
    metadata: json("metadata").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [index("job_events_job_idx").on(table.jobId, table.createdAt)],
);

/** Position consentie et transmise au premier plan pendant une mission active. */
export const jobLocations = mysqlTable(
  "job_locations",
  {
    id: int("id").autoincrement().primaryKey(),
    jobId: int("jobId")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    driverProfileId: int("driverProfileId")
      .notNull()
      .references(() => driverProfiles.id, { onDelete: "cascade" }),
    latitude: decimal("latitude", { precision: 10, scale: 7 }).notNull(),
    longitude: decimal("longitude", { precision: 10, scale: 7 }).notNull(),
    recordedAt: timestamp("recordedAt").defaultNow().notNull(),
    expiresAt: timestamp("expiresAt").notNull(),
  },
  (table) => [index("job_locations_job_recorded_idx").on(table.jobId, table.recordedAt)],
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type DriverProfile = typeof driverProfiles.$inferSelect;
export type Job = typeof jobs.$inferSelect;
