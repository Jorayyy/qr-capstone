<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# qr-capstone (client: EVSU visitor system)

Public registration, QR passes, self check-in, staff scanner, building stops, reports.

## Stack

Next.js 16 App Router, React 19, TypeScript, Tailwind v4, Prisma 7/PostgreSQL, Vercel Blob, Resend/SMTP, tesseract.js OCR, Vitest.

## Commands

- `npm run dev`, `npm run build`, `npm run lint`, `npm run typecheck`, `npm test`
- `npx prisma generate`, `npx prisma migrate deploy`
- `npm run seed` - initial users + **sample visitors/visits**; never run on client data unless asked
- `npm run purge` - deletes old visits, visitors, photos; confirm first

## Invariants

- Client data is sacred: never wipe, reset, or bulk-delete visitors, visits, stops, or departments; confirm destructive DB/ops commands first.
- PH time: server is UTC; use `PH_TZ`/`src/lib/ph-time.ts` and en-PH for displayed times; format date-only values as calendar dates.
- Visit flow: `PENDING -> CHECKED_IN -> CHECKED_OUT` (or `CANCELLED`); QR can expire/revoke. Transitions live in `src/lib/actions/visitors.ts`; RBAC is enforced server-side.
- Roles: `ADMIN`, `STAFF`, `SECURITY`, `RECEPTIONIST`. Scanner/transitions need `visit:transition`; see `src/lib/rbac.ts`.
- Stops: registration pre-creates planned `VisitStop` rows; mark/check out those in `/scanner`, don't duplicate. `/checkin` only flips the visit, not stops.
- OCR: strict parser in `src/lib/registration.ts`; tests in `tests/registration.test.ts`; don't loosen without tests.
- PII: never log secrets, QR values, ID numbers, or full visitor records.

## Deep context

- Read `docs/agent/architecture.md` before changing auth, registration/OCR, scanner/stops, schema, or reports.
