import { describe, expect, it } from "vitest";
import { portalForRole, portalHome, portalHomePath, portalHref } from "@/lib/portal";

describe("portal mapping", () => {
  it("routes each role to its portal", () => {
    expect(portalForRole("ADMIN")).toBe("admin");
    expect(portalForRole("SECURITY")).toBe("guard");
    expect(portalForRole("STAFF")).toBe("staff");
    expect(portalForRole("RECEPTIONIST")).toBe("staff");
  });

  it("falls back to the staff portal for unknown roles", () => {
    expect(portalForRole(null)).toBe("staff");
    expect(portalForRole("HACKER")).toBe("staff");
  });

  it("gives each role its own landing page", () => {
    expect(portalHome("ADMIN")).toBe("/admin/dashboard");
    expect(portalHome("SECURITY")).toBe("/guard");
    expect(portalHome("STAFF")).toBe("/staff/visitors");
    expect(portalHome("RECEPTIONIST")).toBe("/staff/visitors");
  });

  it("builds portal-scoped links", () => {
    expect(portalHref("admin", "/visitors")).toBe("/admin/visitors");
    expect(portalHref("staff", "visitors/register")).toBe("/staff/visitors/register");
    expect(portalHref("guard", "/visitors/abc")).toBe("/guard/visitors/abc");
    expect(portalHref("admin")).toBe("/admin");
    expect(portalHref("guard", "/")).toBe("/guard");
    expect(portalHomePath("staff")).toBe("/staff/visitors");
  });
});
