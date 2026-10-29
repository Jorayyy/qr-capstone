import { describe, expect, it } from "vitest";
import { PERMISSIONS, can } from "@/lib/rbac";

const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Array<keyof typeof PERMISSIONS>;

describe("permission matrix", () => {
  it("ADMIN holds every permission", () => {
    for (const permission of ALL_PERMISSIONS) {
      expect(can("ADMIN", permission), permission).toBe(true);
    }
  });

  it("SECURITY can transition visits, read audit, and register walk-ins", () => {
    expect(can("SECURITY", "visit:transition")).toBe(true);
    expect(can("SECURITY", "audit:read")).toBe(true);
    expect(can("SECURITY", "visit:revoke-qr")).toBe(true);
    expect(can("SECURITY", "visitor:write")).toBe(true);
    expect(can("SECURITY", "visitor:delete")).toBe(false);
    expect(can("SECURITY", "department:manage")).toBe(false);
    expect(can("SECURITY", "users:manage")).toBe(false);
    expect(can("SECURITY", "sessions:manage")).toBe(false);
  });

  it("RECEPTIONIST can register visitors but not delete or read audit", () => {
    expect(can("RECEPTIONIST", "visitor:write")).toBe(true);
    expect(can("RECEPTIONIST", "visit:transition")).toBe(true);
    expect(can("RECEPTIONIST", "visitor:delete")).toBe(false);
    expect(can("RECEPTIONIST", "visit:revoke-qr")).toBe(false);
    expect(can("RECEPTIONIST", "audit:read")).toBe(false);
    expect(can("RECEPTIONIST", "users:manage")).toBe(false);
  });

  it("STAFF has no destructive/admin permissions", () => {
    expect(can("STAFF", "visitor:read")).toBe(true);
    expect(can("STAFF", "visitor:delete")).toBe(false);
    expect(can("STAFF", "department:manage")).toBe(false);
    expect(can("STAFF", "users:manage")).toBe(false);
    expect(can("STAFF", "sessions:manage")).toBe(false);
    expect(can("STAFF", "audit:read")).toBe(false);
  });

  it("staff can read reports but guards cannot", () => {
    expect(can("STAFF", "report:read")).toBe(true);
    expect(can("RECEPTIONIST", "report:read")).toBe(true);
    expect(can("SECURITY", "report:read")).toBe(false);
  });

  it("unknown roles hold nothing", () => {
    for (const permission of ALL_PERMISSIONS) {
      expect(can("HACKER", permission), permission).toBe(false);
      expect(can("", permission), permission).toBe(false);
    }
  });
});
