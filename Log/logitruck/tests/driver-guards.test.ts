import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";
import { canAdvanceJob, isValidCoordinate } from "../shared/logitruck";
import {
  assertAllowedTransition,
  assertAssignedDriver,
  assertAvailableForAcceptance,
  assertValidCoordinates,
} from "../server/services/driver-guards";

describe("garde-fous LogiTruck Driver", () => {
  it("autorise uniquement les transitions séquentielles", () => {
    expect(canAdvanceJob("accepted", "en_route_pickup")).toBe(true);
    expect(canAdvanceJob("loading", "en_route_delivery")).toBe(true);
    expect(canAdvanceJob("accepted", "validated")).toBe(false);
    expect(() => assertAllowedTransition("delivered", "loading")).toThrow(TRPCError);
  });

  it("refuse la progression d’une mission appartenant à un autre chauffeur", () => {
    expect(() => assertAssignedDriver(7, 9)).toThrow(TRPCError);
    expect(() => assertAssignedDriver(7, null)).toThrow(TRPCError);
    expect(() => assertAssignedDriver(7, 7)).not.toThrow();
  });

  it("refuse l’acceptation hors ligne ou avec une mission active", () => {
    expect(() => assertAvailableForAcceptance(false, false)).toThrow(TRPCError);
    expect(() => assertAvailableForAcceptance(true, true)).toThrow(TRPCError);
    expect(() => assertAvailableForAcceptance(true, false)).not.toThrow();
  });

  it("valide strictement les coordonnées GPS", () => {
    expect(isValidCoordinate(6.37, 2.43)).toBe(true);
    expect(isValidCoordinate(91, 2.43)).toBe(false);
    expect(isValidCoordinate(6.37, -181)).toBe(false);
    expect(() => assertValidCoordinates(-90, 180)).not.toThrow();
    expect(() => assertValidCoordinates(Number.NaN, 2.43)).toThrow(TRPCError);
  });
});
