# Running the Visitor Management System locally

For a laptop demo or final defense. Setup time: about 10–15 minutes.

---

## 1. What you need

| Requirement | Notes |
|---|---|
| **Node.js 22.12+ or 24 LTS** | Do **not** use Node 21 or 23. |
| **Git** (or a ZIP copy of the project) | To download the code. |
| **A PostgreSQL database** | Easiest: a free [Neon](https://neon.tech) database. |
| **A Vercel Blob token** (for photos) | Free Vercel account. Needed because registration uploads an ID photo. |
| Internet connection | For installing packages and connecting to the database. |

> ### ❌ XAMPP will not work
> XAMPP provides **MySQL/MariaDB**. This system requires **PostgreSQL** — it uses
> the `pg` driver and PostgreSQL-specific migrations. A `mysql://` connection
> string is rejected by the setup script. Use Neon (recommended), the PostgreSQL
> installer, or Docker instead.

---

## 2. Install Node.js

Download the **LTS** installer from <https://nodejs.org> and install it.

Verify in a terminal:

```bash
node --version    # v22.x or v24.x
npm --version
```

---

## 3. Get the project

```bash
git clone https://github.com/Jorayyy/qr-capstone.git
cd qr-capstone
```

No Git? Download the ZIP from GitHub and extract it.

---

## 4. Install the dependencies

```bash
npm ci
```

Takes 1–3 minutes the first time.

---

## 5. Create the PostgreSQL database

### Option A — Neon (recommended: no install, works on any laptop)

1. Open <https://neon.tech> and sign up (Google, GitHub, or email).
2. Click **New Project**.
   - Name: `qr-capstone`
   - Region: pick the closest to you (e.g. **Singapore** for the Philippines).
3. Wait for the project to finish provisioning.
4. On the project dashboard, click **Connect** (top-right).
5. In the connection dialog:
   - Turn **Connection pooling** **ON**.
   - Select **Prisma** if the toggle is shown.
   - Copy the string that starts with `postgresql://`.
6. It will look like this (yours will differ):

   ```
   postgresql://neondb_owner:AbCdEf123456@ep-cool-name-123456-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
   ```

7. Keep that string — it goes into `.env` in the next step. Treat it like a password.

> **Why Neon?** Nothing to install, no port conflicts, and it survives a laptop
> restart. The free tier is more than enough for a defense.

### Option B — Local PostgreSQL (fully offline)

1. Install **PostgreSQL 16+** from <https://www.postgresql.org/download/>.
2. During install, set a password for the `postgres` user (remember it).
3. Keep port `5432`.
4. Create a database named `qr` (using pgAdmin or `createdb qr`).
5. Your connection string is:

   ```
   postgresql://postgres:YOUR_PASSWORD@localhost:5432/qr?schema=public
   ```

### Option C — Docker (if Docker is already installed)

```bash
docker run --name qr-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=qr -p 5432:5432 -d postgres:16
```

Connection string:

```
postgresql://postgres:postgres@localhost:5432/qr?schema=public
```

---

## 6. Create the `.env` file (the setup script does it for you)

Run:

```bash
npm run setup
```

It asks 5 questions and writes `.env` automatically, including a randomly
generated `SESSION_SECRET`:

| Question | What to enter |
|---|---|
| PostgreSQL DATABASE_URL | Paste the `postgresql://…` string from step 5. |
| Vercel Blob token | Paste the token from below, or press **Enter** to skip. |
| App URL | Press **Enter** for `http://localhost:3000`. |
| Admin password | Press **Enter** for `Admin@EVSU2026`, or type your own. |
| Guard password | Press **Enter** for `Guard@EVSU2026`, or type your own. |

If `.env` already exists, it refuses to overwrite. Use `npm run setup -- --force`
to replace it.

### Getting the Blob token (for visitor photos)

1. Sign in at <https://vercel.com>.
2. Open **Storage** in the left sidebar.
3. Click **Create Database** → **Blob**.
4. Name it (e.g. `qr-photos`) and set access to **Private**.
5. Open the new store → **Quickstart** / **`.env`** tab.
6. Copy the value of `BLOB_READ_WRITE_TOKEN` (starts with `vercel_blob_rw_…`).
7. Paste it when `npm run setup` asks for it.

> Skipping the Blob token is allowed, but photo uploads (including the public
> pre-registration ID photo) will fail. Staff/guard registration without photos
> still works.

### Manual alternative

If you prefer to edit by hand:

```bash
copy .env.example .env      # Windows
cp .env.example .env        # macOS / Linux
```

Then set `DATABASE_URL`, `SESSION_SECRET`, `BLOB_READ_WRITE_TOKEN`, and
`APP_URL`. Generate a secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 7. Prepare the database

One command does all three steps:

```bash
npm run db:setup
```

It runs:

- `prisma generate` — builds the Prisma client.
- `prisma migrate deploy` — creates all tables.
- `tsx prisma/seed.ts` — creates the initial users, departments, and sample data.

> ⚠️ Run this **once**. `seed` is not idempotent; a second run fails on duplicate
> sample records.

If you did not set `SEED_ADMIN_PASSWORD` / `SEED_SECURITY_PASSWORD`, the seed
prints the generated passwords to the terminal **once**. Copy them immediately.

---

## 8. Start the system

```bash
npm run dev
```

Open <http://localhost:3000>. Stop the server with `Ctrl + C`.

---

## 9. Log in

| Role | Email | Password |
|---|---|---|
| Admin | `admin@university.edu` | `Admin@EVSU2026` (or what you entered) |
| Guard / Security | `security@university.edu` | `Guard@EVSU2026` (or what you entered) |

Both accounts must change their password on first sign-in.

Create Staff/Receptionist accounts as Admin under **Security → Users**.

---

## 10. Common problems

| Problem | Fix |
|---|---|
| `Node.js version is not supported` | Install Node 22.12+ or 24 LTS. |
| `Can't reach database server` | Check `DATABASE_URL`, internet, and that it ends with `?sslmode=require`. |
| `Environment variable not found: DATABASE_URL` | `.env` is missing or not next to `package.json`. Run `npm run setup`. |
| `mysql://` rejected | XAMPP/MySQL is not supported. Use PostgreSQL (step 5). |
| Photo upload fails | Add `BLOB_READ_WRITE_TOKEN` to `.env` and restart. |
| Port 3000 already in use | `npm run dev -- -p 3001`, then open `http://localhost:3001`. |
| Login "invalid" after re-seeding | Seed only sets the initial password on the first run. Use the password you chose at first sign-in. |

---

## 11. Restarting later

No need to repeat steps 4–7:

```bash
cd qr-capstone
npm run dev
```

---

## Optional: production-style run

```bash
npm run build
npm start
```

Use this if the panel wants to see the optimized build instead of dev mode.
