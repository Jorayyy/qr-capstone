import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { can, type Permission } from "@/lib/rbac";
import {
  adminResetMfaAction,
  adminResetPasswordAction,
  createUserAction,
  revokeSessionAction,
  revokeUserSessionsAction,
  setUserActiveAction,
  setUserRoleAction,
  unlockUserAction,
} from "@/lib/actions/admin";
import { USER_ROLES } from "@/lib/validation";
import { Badge, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { CreateUserForm, RoleSelect, RowAction } from "./security-client";

const TABS = [
  { key: "users", label: "Users", permission: "users:manage" as Permission },
  { key: "sessions", label: "Sessions", permission: "sessions:manage" as Permission },
  { key: "audit", label: "Audit log", permission: "audit:read" as Permission },
];

const AUDIT_PAGE_SIZE = 50;

function shortId(id: string): string {
  return id.length > 12 ? `${id.slice(0, 8)}…` : id;
}

function formatDateTime(date: Date): string {
  return date.toISOString().replace("T", " ").slice(0, 16);
}

export default async function SecurityPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; page?: string; action?: string }>;
}) {
  const session = await requireSession();
  const { tab: rawTab, page: rawPage, action: rawAction } = await searchParams;

  const allowed = TABS.filter((t) => can(session.role, t.permission));
  if (allowed.length === 0) redirect("/admin/dashboard");

  const tab = allowed.some((t) => t.key === rawTab) ? rawTab! : allowed[0].key;

  return (
    <div>
      <PageHeader
        title="Security"
        subtitle="Users, sessions and audit trail"
      />

      <div className="mb-5 flex gap-1 border-b border-[var(--border)]">
        {allowed.map((t) => (
          <Link
            key={t.key}
            href={`/admin/security?tab=${t.key}`}
            className={
              t.key === tab
                ? "border-b-2 border-[var(--brand)] px-4 py-2 text-sm font-semibold text-[var(--brand)]"
                : "px-4 py-2 text-sm font-medium text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
            }
          >
            {t.label}
          </Link>
        ))}
      </div>

      {tab === "users" && <UsersSection actorId={session.userId} />}
      {tab === "sessions" && <SessionsSection actorId={session.userId} />}
      {tab === "audit" && <AuditSection page={rawPage} actionFilter={rawAction} />}
    </div>
  );
}

async function UsersSection({ actorId }: { actorId: string }) {
  const users = await db.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      failedLogins: true,
      lockedUntil: true,
      mfaEnabled: true,
      mustChangePassword: true,
      createdAt: true,
    },
  });

  const now = new Date();

  return (
    <div className="space-y-5">
      <CreateUserForm action={createUserAction} roles={USER_ROLES} />

      <Card>
        <CardHeader title="Accounts" subtitle={`${users.length} total`} />
        <div className="overflow-x-auto">
          <table className="data-table min-w-[760px]">
            <thead>
              <tr>
                <th className="px-5 py-3">User</th>
                <th className="px-5 py-3">Role</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">MFA</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isSelf = u.id === actorId;
                const locked = Boolean(u.lockedUntil && u.lockedUntil > now);
                return (
                  <tr key={u.id}>
                    <td className="px-5 py-3">
                      <p className="font-medium">{u.name}{isSelf ? " (you)" : ""}</p>
                      <p className="text-xs text-[var(--muted)]">{u.email}</p>
                    </td>
                    <td className="px-5 py-3">
                      <RoleSelect
                        action={setUserRoleAction}
                        userId={u.id}
                        currentRole={u.role}
                        roles={USER_ROLES}
                        disabled={isSelf}
                      />
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        <Badge tone={u.isActive ? "green" : "red"}>
                          {u.isActive ? "Active" : "Disabled"}
                        </Badge>
                        {locked && <Badge tone="amber">Locked</Badge>}
                        {u.failedLogins > 0 && !locked && (
                          <Badge tone="amber">{u.failedLogins} fails</Badge>
                        )}
                        {u.mustChangePassword && <Badge tone="brand">Pwd reset</Badge>}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <Badge tone={u.mfaEnabled ? "green" : "gray"}>
                        {u.mfaEnabled ? "On" : "Off"}
                      </Badge>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        {locked && (
                          <RowAction action={unlockUserAction} fields={{ userId: u.id }}>
                            Unlock
                          </RowAction>
                        )}
                        <RowAction
                          action={adminResetPasswordAction}
                          fields={{ userId: u.id }}
                          confirmText={`Reset password for ${u.email}?`}
                        >
                          Reset pwd
                        </RowAction>
                        {u.mfaEnabled && (
                          <RowAction
                            action={adminResetMfaAction}
                            fields={{ userId: u.id }}
                            variant="danger"
                            confirmText={`Reset MFA for ${u.email}?`}
                          >
                            Reset MFA
                          </RowAction>
                        )}
                        {!isSelf && (
                          <>
                            <RowAction
                              action={revokeUserSessionsAction}
                              fields={{ userId: u.id }}
                              confirmText={`Sign out ${u.email} everywhere?`}
                            >
                              Sign out
                            </RowAction>
                            <RowAction
                              action={setUserActiveAction}
                              fields={{ userId: u.id, active: u.isActive ? "false" : "true" }}
                              variant="danger"
                              confirmText={
                                u.isActive
                                  ? `Deactivate ${u.email}?`
                                  : `Activate ${u.email}?`
                              }
                            >
                              {u.isActive ? "Deactivate" : "Activate"}
                            </RowAction>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

async function SessionsSection({ actorId }: { actorId: string }) {
  const now = new Date();
  const sessions = await db.session.findMany({
    where: { revokedAt: null, absoluteExpiresAt: { gt: now } },
    orderBy: { lastSeenAt: "desc" },
    take: 100,
    select: {
      id: true,
      userId: true,
      createdAt: true,
      lastSeenAt: true,
      ip: true,
      userAgent: true,
      mfaPending: true,
      user: { select: { email: true, name: true } },
    },
  });

  return (
    <Card>
      <CardHeader
        title="Active sessions"
        subtitle={`${sessions.length} shown (most recent 100)`}
      />
      {sessions.length === 0 ? (
        <EmptyState title="No active sessions" />
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table min-w-[680px]">
            <thead>
              <tr>
                <th className="px-5 py-3">User</th>
                <th className="px-5 py-3">IP</th>
                <th className="px-5 py-3">Device</th>
                <th className="px-5 py-3">Last seen</th>
                <th className="px-5 py-3">State</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id}>
                  <td className="px-5 py-3">
                    <p className="font-medium">{s.user.name}</p>
                    <p className="text-xs text-[var(--muted)]">{s.user.email}</p>
                  </td>
                  <td className="px-5 py-3 font-mono text-xs">{s.ip ?? "—"}</td>
                  <td className="max-w-[240px] truncate px-5 py-3 text-xs text-[var(--muted)]">
                    {s.userAgent ?? "—"}
                  </td>
                  <td className="px-5 py-3 text-xs">{formatDateTime(s.lastSeenAt)}</td>
                  <td className="px-5 py-3">
                    {s.mfaPending ? <Badge tone="amber">MFA pending</Badge> : <Badge tone="green">Active</Badge>}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {s.userId === actorId ? (
                      <span className="text-xs text-[var(--muted)]">Your session</span>
                    ) : (
                      <RowAction
                        action={revokeSessionAction}
                        fields={{ userId: s.id }}
                        variant="danger"
                        confirmText={`Revoke this session for ${s.user.email}?`}
                      >
                        Revoke
                      </RowAction>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

async function AuditSection({
  page,
  actionFilter,
}: {
  page?: string;
  actionFilter?: string;
}) {
  const pageNum = Math.max(parseInt(page ?? "1", 10) || 1, 1);
  const filter = actionFilter && /^[A-Z0-9_]{1,64}$/.test(actionFilter) ? actionFilter : undefined;

  const where = filter ? { action: filter } : undefined;

  const [entries, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (pageNum - 1) * AUDIT_PAGE_SIZE,
      take: AUDIT_PAGE_SIZE,
      select: {
        id: true,
        createdAt: true,
        actorEmail: true,
        action: true,
        targetType: true,
        targetId: true,
        result: true,
        ip: true,
        meta: true,
      },
    }),
    db.auditLog.count({ where }),
  ]);

  const totalPages = Math.max(Math.ceil(total / AUDIT_PAGE_SIZE), 1);
  const knownActions = await db.auditLog.findMany({
    distinct: ["action"],
    orderBy: { action: "asc" },
    select: { action: true },
  });

  return (
    <Card>
      <CardHeader
        title="Audit log"
        subtitle={`${total} entries${filter ? ` filtered by ${filter}` : ""}`}
        action={
          <form method="GET" className="flex items-center gap-2">
            <input type="hidden" name="tab" value="audit" />
            <select
              name="action"
              defaultValue={filter ?? ""}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs focus:border-[var(--brand)] focus:outline-none"
            >
              <option value="">All actions</option>
              {knownActions.map((a) => (
                <option key={a.action} value={a.action}>
                  {a.action}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--muted)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
            >
              Filter
            </button>
          </form>
        }
      />
      {entries.length === 0 ? (
        <EmptyState title="No audit entries" hint="Security-relevant events will appear here." />
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table min-w-[880px]">
            <thead>
              <tr>
                <th className="px-5 py-3">Time</th>
                <th className="px-5 py-3">Action</th>
                <th className="px-5 py-3">Result</th>
                <th className="px-5 py-3">Actor</th>
                <th className="px-5 py-3">Target</th>
                <th className="px-5 py-3">IP</th>
                <th className="px-5 py-3">Details</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td className="whitespace-nowrap px-5 py-3 text-xs">{formatDateTime(e.createdAt)}</td>
                  <td className="whitespace-nowrap px-5 py-3 font-mono text-xs">{e.action}</td>
                  <td className="px-5 py-3">
                    <Badge tone={e.result === "SUCCESS" ? "green" : e.result === "DENIED" ? "amber" : "red"}>
                      {e.result}
                    </Badge>
                  </td>
                  <td className="px-5 py-3 text-xs">{e.actorEmail ?? "—"}</td>
                  <td className="px-5 py-3 font-mono text-xs">
                    {e.targetType ? `${e.targetType}:${e.targetId ? shortId(e.targetId) : "—"}` : "—"}
                  </td>
                  <td className="px-5 py-3 font-mono text-xs">{e.ip ?? "—"}</td>
                  <td className="max-w-[260px] truncate px-5 py-3 text-xs text-[var(--muted)]">
                    {e.meta ? JSON.stringify(e.meta) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-[var(--border)] px-5 py-3 text-sm">
          <Link
            href={`/admin/security?tab=audit&page=${Math.max(pageNum - 1, 1)}${filter ? `&action=${filter}` : ""}`}
            className={pageNum > 1 ? "font-medium text-[var(--brand)] hover:underline" : "pointer-events-none text-[var(--muted)]"}
          >
            ← Previous
          </Link>
          <span className="text-xs text-[var(--muted)]">
            Page {pageNum} of {totalPages}
          </span>
          <Link
            href={`/admin/security?tab=audit&page=${Math.min(pageNum + 1, totalPages)}${filter ? `&action=${filter}` : ""}`}
            className={pageNum < totalPages ? "font-medium text-[var(--brand)] hover:underline" : "pointer-events-none text-[var(--muted)]"}
          >
            Next →
          </Link>
        </div>
      )}
    </Card>
  );
}
