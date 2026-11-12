# Running the Visitor Management System locally

This guide is for running the system on a laptop (Windows, macOS, or Linux) for a
demo or final defense. Total setup time: about 10–15 minutes.

---

## 1. What you need

| Requirement | Notes |
|---|---|
| **Node.js 22.12+ or 24 LTS** | Do **not** use Node 21 or 23. |
| **Git** (or a ZIP copy of the project) | To download the code. |
| **A PostgreSQL database** | Easiest: a free [Neon](https://neon.tech) database. |
| **A Vercel Blob token** (for photos) | Free Vercel account. Needed because visitor registration uploads an ID photo. |
| Internet connection | For installing packages and connecting to the cloud database. |

---

## 2. Install Node.js

Download the **LTS** installer from <https://nodejs.org> and install it.

Verify in a terminal (Command Prompt / PowerShell / Terminal):

```bash
node --version    # should print v22.x or v24.x
npm --version
```

---

## 3. Get the project

```bash
git clone https://github.com/Jorayyy/qr-capstone.git
cd qr-capstone
```

If Git is not available, download the repository as a ZIP from GitHub and extract it.

---

## 4. Install the dependencies

```bash
npm ci
```

This takes 1–3 minutes the first time.

---

## 5. Create the database

### Option A — Neon (recommended, no install)

1. Sign up at <https://neon.tech>.
2. Create a project (any name, nearest region).
3. Copy the **pooled** connection string. It looks like:

   ```
   postgresql://USER:PASSWORD@ep-xxxx-pooler.REGION.aws.neon.tech/neondb?sslmode=require
   ```

   Keep `?sslmode=require` at the end.

### Option B — Local PostgreSQL

1. Install PostgreSQL 16 or newer.
2. Create a database named `qr`.
3. Your connection string will be:

   ```
   postgresql://postgres:YOUR_PASSWORD@localhost:5432/qr?schema=public
   ```

---

## 6. Create the `.env` file

Copy the example file:

```bash
# Windows (Command Prompt)
copy .env.example .env

# macOS / Linux / Git Bash
cp .env.example .env
```

Open `.env` in a text editor and set these values:

```env
DATABASE_URL="<your connection string from step 5>"

# Generate one with:
#   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
SESSION_SECRET="<paste the 64-character random string here>"

BLOB_READ_WRITE_TOKEN="<your Vercel Blob token>"

APP_URL="http://localhost:3000"

# Optional but recommended for the demo — makes the login passwords predictable.
SEED_ADMIN_PASSWORD="Admin@EVSU2026"
SEED_SECURITY_PASSWORD="Guard@EVSU2026"
```

### Getting the Blob token

1. Sign in at <https://vercel.com>.
2. Go to **Storage → Blob → Create Database/Store**.
3. Choose **Private** access.
4. Copy the `BLOB_READ_WRITE_TOKEN` value into `.env`.

> Email is optional. Leave `SMTP_*` and `RESEND_API_KEY` unset — the QR code
> will simply be shown and downloadable on screen instead of emailed.

---

## 7. Prepare the database

Run these three commands **once**, in order:

```bash
npx prisma generate
npx prisma migrate deploy
npm run seed
```

What they do:

- `generate` — builds the Prisma client used by the app.
- `migrate deploy` — creates all database tables.
- `seed` — creates the initial users and sample data.

> ⚠️ Run `npm run seed` **only once**. It is not idempotent; running it again
> will fail on duplicate sample records.

If you did **not** set `SEED_ADMIN_PASSWORD` / `SEED_SECURITY_PASSWORD`, the seed
prints the generated passwords to the terminal **once**. Copy them immediately.

---

## 8. Start the system

```bash
npm run dev
```

Open <http://localhost:3000> in a browser.

To stop the server, press `Ctrl + C` in the terminal.

---

## 9. Log in

| Role | Email | Password |
|---|---|---|
| Admin | `admin@university.edu` | `Admin@EVSU2026` (or the printed one) |
| Guard / Security | `security@university.edu` | `Guard@EVSU2026` (or the printed one) |

Both accounts are forced to change their password on first sign-in.

Staff and receptionist accounts are created by the Admin under
**Security → Users**.

---

## 10. Common problems

| Problem | Fix |
|---|---|
| `Node.js version is not supported` | Install Node 22.12+ or 24 LTS. |
| `Can't reach database server` | Check `DATABASE_URL`, internet, and that it ends with `?sslmode=require`. |
| `Environment variable not found: DATABASE_URL` | `.env` is missing or in the wrong folder. It must sit next to `package.json`. |
| Photo upload fails / `BLOB_READ_WRITE_TOKEN` missing | Add the Vercel Blob token to `.env` and restart. |
| Port 3000 already in use | Run `npm run dev -- -p 3001`, then open `http://localhost:3001`. |
| Login says "invalid" after re-seeding | Seed only sets the initial password on the first run. Use the password you chose at first sign-in. |

---

## 11. Restarting later

You do **not** need to repeat steps 4–7. Just open the project folder and run:

```bash
npm run dev
```

---

## Optional: production-style run

```bash
npm run build
npm start
```

Use this if the panel wants to see the optimized build instead of dev mode.
