/**
 * Server-side permission matrix over the four existing roles.
 * Authorization decisions MUST be made here (server-side) — never from
 * values supplied by the browser.
 */
export const PERMISSIONS = {
  "visit:read": ["ADMIN", "STAFF", "SECURITY", "RECEPTIONIST"],
  "visitor:read": ["ADMIN", "STAFF", "SECURITY", "RECEPTIONIST"],
  "visitor:write": ["ADMIN", "STAFF", "RECEPTIONIST", "SECURITY"],
  "visitor:delete": ["ADMIN"],
  "visit:transition": ["ADMIN", "STAFF", "SECURITY", "RECEPTIONIST"],
  "visit:revoke-qr": ["ADMIN", "SECURITY"],
  "department:read": ["ADMIN", "STAFF", "SECURITY", "RECEPTIONIST"],
  "department:manage": ["ADMIN"],
  "users:manage": ["ADMIN"],
  "sessions:manage": ["ADMIN"],
  "audit:read": ["ADMIN", "SECURITY"],
  "report:read": ["ADMIN", "STAFF", "RECEPTIONIST"],
} as const;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: string, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly string[]).includes(role);
}

export function canAll(role: string, permissions: Permission[]): boolean {
  return permissions.every((p) => can(role, p));
}
