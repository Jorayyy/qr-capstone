# Creating demo credentials (owner only)

Use these steps to create a **separate** Neon database and Vercel Blob store for
client demos. Never hand out the production `DATABASE_URL` or production
`BLOB_READ_WRITE_TOKEN`.

You will end up with two values to give clients:

- `DEMO_DATABASE_URL` — a Neon PostgreSQL URL
- `DEMO_BLOB_READ_WRITE_TOKEN` — a Vercel Blob token

---

## 1. Create the demo Neon project

1. Sign in at <https://neon.tech>.
2. Click **New Project**.
   - Name: `qr-capstone-demo`
   - Region: **Singapore** (or closest to the clients)
3. Wait for provisioning.
4. Click **Connect**.
   - **Connection pooling: ON**
   - Select **Prisma** if shown
   - Copy the `postgresql://…?sslmode=require` string
5. Save it somewhere safe as **`DEMO_DATABASE_URL`**.

> Keep the production project untouched. The demo project has its own data,
> users, and audit logs.

---

## 2. Create the demo Blob store

1. Sign in at <https://vercel.com>.
2. Open **Storage** → **Create Database** → **Blob**.
3. Name: `qr-photos-demo`
4. Access: **Private**
5. Open the store → **Quickstart** / **`.env`** tab.
6. Copy `BLOB_READ_WRITE_TOKEN` (starts with `vercel_blob_rw_…`).
7. Save it as **`DEMO_BLOB_READ_WRITE_TOKEN`**.

> A Blob token is scoped to its store, so this token cannot touch production
> photos.

---

## 3. Initialize the demo database (once)

You do **not** need to overwrite your local `.env`. Pass the demo URL inline —
Prisma and the seed read `process.env` first, and `.env` does not override it.

**PowerShell (Windows):**

```powershell
$env:DATABASE_URL="<DEMO_DATABASE_URL>"
npm run db:setup
Remove-Item Env:DATABASE_URL
```

**macOS / Linux / Git Bash:**

```bash
DATABASE_URL="<DEMO_DATABASE_URL>" npm run db:setup
```

This runs `prisma generate`, `prisma migrate deploy`, and the seed. The seed
creates:

- `admin@university.edu` — password `Admin@EVSU2026` (unless overridden)
- `security@university.edu` — password `Guard@EVSU2026` (unless overridden)
- sample departments and visitors

> Run it **once** per demo database. The seed is not idempotent.

---

## 4. Smoke-test the demo credentials locally

Create a temporary `.env` pointing at the demo DB, or pass env vars inline:

```powershell
$env:DATABASE_URL="<DEMO_DATABASE_URL>"
$env:BLOB_READ_WRITE_TOKEN="<DEMO_BLOB_READ_WRITE_TOKEN>"
$env:SESSION_SECRET="<any 32+ char string>"
npm run dev
```

Open <http://localhost:3000>, log in, register a test visitor, upload a photo,
then scan the QR. If all works, the demo credentials are good.

---

## 5. Give clients these items

Send only:

1. Repository link: `https://github.com/Jorayyy/qr-capstone`
2. `docs/RUN-LOCALLY.md`
3. `DEMO_DATABASE_URL`
4. `DEMO_BLOB_READ_WRITE_TOKEN`

Their steps:

```bash
npm ci
npm run setup     # paste the demo URL + demo Blob token
npm run db:setup  # SKIP if the demo DB is already seeded
npm run dev
```

> If multiple clients share one demo database, they will see each other's data.
> For isolated demos, see the next section.

---

## 6. Optional: one database per client (isolated)

**Option A — separate Neon projects**
Repeat section 1 for each client (`qr-capstone-demo-1`, `-2`, …). Free tier
allows a handful of projects.

**Option B — Neon branches (cheaper, same project)**
1. Open the demo project in Neon.
2. **Branches** → **New Branch** → name it after the client.
3. Connect to that branch and copy its pooled URL.
4. Run section 3 once per branch.
5. Give each client their branch URL.

Each branch has independent tables and data.

---

## 7. After the defense

- Delete the demo Neon project/branches, **or** reset its password.
- Delete the demo Blob store, **or** rotate its token.
- Never leave demo credentials active longer than needed.
