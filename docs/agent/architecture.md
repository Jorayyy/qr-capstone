# qr-capstone architecture

## Project

EVSU visitor management system. Public pre-registration, QR visitor passes, self check-in/out, staff scanner, per-office building stops, reports, and audit logging.

## Stack

- Next.js 16 App Router, React 19, TypeScript
- Tailwind CSS v4 via PostCSS; no `tailwind.config.js`
- Prisma 7 + PostgreSQL through `@prisma/adapter-pg`; generated client in `src/generated/prisma`
- Auth: opaque session cookie `vms-session`, Argon2id passwords, optional TOTP MFA
- RBAC: `src/lib/rbac.ts` (`ADMIN`, `STAFF`, `SECURITY`, `RECEPTIONIST`)
- Uploads: Vercel Blob; email: SMTP first, then Resend (`src/lib/email.ts`)
- OCR: tesseract.js in the browser; strict parser in `src/lib/registration.ts`
- Tests: Vitest (`tests/*.test.ts`); CI runs lint + typecheck + test + build

## Routes

Public:

- `/` - public entry page
- `/register` - pre-registration; creates Visitor + Visit + planned VisitStops
- `/pass/[code]` - visitor pass with QR
- `/checkin` - public self check-in/out by pass code
- `/office/[id]` - public office preview
- `/privacy` - privacy notice

Staff (`src/app/(app)/`):

- `/dashboard`, `/visitors`, `/visitors/register`, `/visitors/[id]`
- `/scanner` - requires `visit:transition`
- `/departments`, `/departments/new`, `/departments/[id]/edit`
- `/reports` - admin only
- `/security` - security/audit tools
- `/account/password`, `/account/security`

API:

- `GET /api/visits/lookup?qr=` - authenticated, rate-limited staff projection with stops
- `POST /api/visits/self-checkin` - public, same-origin, rate-limited; pass code only
- `/api/departments`, `/api/uploads`, `/api/register/uploads`
- photo proxies: `/api/visitor-photo`, `/api/pass-photo`, `/api/department-photo`

## Data model

Core Prisma models: `User`, `Session`, `AuditLog`, `RateLimit`, `Department`, `Visitor`, `Visit`, `VisitStop`, `QRTemplate`.

- `VisitStatus`: `PENDING`, `CHECKED_IN`, `CHECKED_OUT`, `CANCELLED`
- `UserRole`: `ADMIN`, `STAFF`, `SECURITY`, `RECEPTIONIST`
- `Visit` holds the pass QR, reference code, visitor, primary department, purpose, and actual arrival/departure.
- `VisitStop` is one office on the trip; `checkedInAt`/`checkedOutAt` are nullable. Registration pre-creates planned rows with both null.
- Migrations live in `prisma/migrations`; use `npx prisma migrate deploy`, not `db push`, for this repo.

## Visit and stop flow

1. Public `/register` creates the Visitor, a `PENDING` Visit, and one planned `VisitStop` per selected office.
2. Visitor gets `/pass/[code]` with the QR.
3. Visitor may self check in/out at `/checkin`; this only changes the whole Visit, never stops.
4. Staff scans at `/scanner`:
   - `PENDING` -> Check In
   - planned stops show **Mark arrived**, then **Check Out**
   - unplanned offices use the dropdown; `addVisitStopAction` updates a matching planned stop instead of duplicating
   - visit Check Out closes the visit and any active stops
5. `/visitors/[id]` shows stop statuses; its controls are visit-level only.

Server actions are in `src/lib/actions/visitors.ts` (`checkInAction`, `checkOutAction`, `cancelVisitAction`, `addVisitStopAction`, `checkInStopAction`, `checkOutStopAction`, `revokeQrAction`). Public registration is `src/lib/actions/public-registration.ts`.

## Auth and RBAC

- `src/lib/auth.ts`: `getSession`, `requireSession`, `requirePermission`, session revoke helpers.
- Every server action/API route enforces its own permission; the UI is not the authority.
- `visit:transition` covers scanner, visit transitions, and stop actions.
- `visitor:delete`, `department:manage`, `users:manage`, `sessions:manage`, `report:read` are admin-only.
- `visit:revoke-qr` and `audit:read`: admin/security.
- The lookup API requires a logged-in session plus rate limits; it is not public.

## Time

The app runs on Vercel in UTC. All displayed dates/times must use `Asia/Manila`.

- `src/lib/ph-time.ts`: `PH_TZ`, `PH_OFFSET_MS`, `manilaParts`, `manilaMidnight`
- `src/lib/registration.ts`: `manilaDayBounds`, `resolveVisitWindow`, `todayIso`
- Use en-PH locale. For date-only DB values, format them as calendar dates to avoid UTC midnight shifts.

Known gap: `src/app/checkin/checkin-form.tsx` formats the confirmation time with `en-PH` but no explicit `timeZone`; add `timeZone: PH_TZ` when touching it.

## Registration and OCR

- `src/lib/registration.ts` exports `parseIdCardText` and `filterOcrTextByConfidence`.
- Parser is intentionally strict: name headers, DOB label windows, calendar validation, expiration rejection, ID type detection, PhilSys/UMID/passport/LTO handling, OCR digit corrections.
- `tests/registration.test.ts` covers the parser and OCR confidence filtering. Keep tests green; do not loosen extraction without new cases.
- IDs and photos are PII; never log raw values.

## Ops and data safety

- `npm run seed`: upserts initial admin/security users and departments, then creates sample visitors/visits. Not idempotent for sample data; do not run against client/production data unless the user asks.
- `npm run purge`: deletes old audits/sessions/visits/visitors/orphan Blob photos. Never run without explicit confirmation.
- `SESSION_SECRET` and `DATABASE_URL` are required; production fails fast without a secret.
- CI: `.github/workflows/ci.yml` runs lint, typecheck, test, build. Dependabot is weekly.

## Gotchas

- The README's `/kiosk/*` section is stale; those routes are not in `src/app`. Current public entry is `/checkin`; staff tool is `/scanner`.
- `/checkin` page copy mentions entering an ID number, but `selfCheckinSchema` only accepts the pass code (`qr`). Confirm the intended flow before changing either side.
- Stop ordering uses `checkedInAt asc` (nulls last), so marking a planned stop moves it in the list.
- `next dev` re-adds the `nextjs-agent-rules` block in `AGENTS.md`; keep it committed.
