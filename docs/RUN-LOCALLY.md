# Running the Visitor Management System locally

For a laptop demo or final defense. Setup time: about 5 minutes.

---

## 1. What you need

| Requirement | Notes |
|---|---|
| **Node.js 22.12+ or 24 LTS** | Do **not** use Node 21 or 23. |
| **Git** (or a ZIP copy of the project) | To download the code. |
| **Internet connection** | The database and photo storage are hosted. |
| **`demo.env`** | Sent to you privately. Contains the demo database + photo storage credentials. |

> ### ❌ XAMPP will not work
> XAMPP provides **MySQL/MariaDB**. This system requires **PostgreSQL**.
> The setup script rejects a `mysql://` URL.
>
> You do **not** need to install any database — the demo credentials point to a
> hosted PostgreSQL database.

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

No Git? Download the ZIP from GitHub and extract it.

---

## 4. Put `demo.env` in the project folder

Copy the `demo.env` file you were given into the `qr-capstone` folder — the same
folder that contains `package.json`.

It looks like this:

```env
DATABASE_URL="postgresql://..."
BLOB_READ_WRITE_TOKEN="vercel_blob_rw_..."
```

> Keep this file private. Do not post it, commit it, or share it publicly.

---

## 5. Run one command

```bash
npm run client:setup
```

That single command does everything:

1. Reads `demo.env` and creates your `.env` file (with a random `SESSION_SECRET`).
2. Installs the dependencies (first run only, 1–3 minutes).
3. Builds the Prisma client.
4. Creates/updates all database tables.
5. Seeds the demo accounts and sample data (safe to re-run).
6. Starts the system.

When it finishes, open **<http://localhost:3000>**.

Stop the server with `Ctrl + C` in the terminal.

### If you were not given `demo.env`

The script will ask you to paste the values instead:

| Prompt | What to paste |
|---|---|
| `DATABASE_URL` | The `postgresql://…` URL you were given |
| `BLOB_READ_WRITE_TOKEN` | The `vercel_blob_rw_…` token you were given |

### Options

```bash
npm run client:setup -- --no-start      # set up only, don't start the server
npm run client:setup -- --force         # overwrite an existing .env
npm run client:setup -- --database-url="postgresql://..." --blob-token="vercel_blob_rw_..."
```

---

## 6. Log in

| Role | Email | Password |
|---|---|---|
| Admin | `admin@university.edu` | `Admin@EVSU2026` |
| Guard / Security | `security@university.edu` | `Guard@EVSU2026` |

Both accounts are forced to change their password on first sign-in.

Create Staff/Receptionist accounts as Admin under **Security → Users**.

---

## 7. Restarting later

Open the project folder and run:

```bash
npm run dev
```

You do **not** need to repeat `npm run client:setup`.

---

## 8. Common problems

| Problem | Fix |
|---|---|
| `Node.js version is not supported` | Install Node 22.12+ or 24 LTS. |
| `DATABASE_URL is required` | `demo.env` is missing, or not next to `package.json`. |
| `Can't reach database server` | Check your internet connection. |
| `mysql://` rejected | XAMPP/MySQL is not supported. Use the demo credentials. |
| Photo upload fails | `BLOB_READ_WRITE_TOKEN` is missing from `demo.env`. |
| Port 3000 already in use | Run `npm run dev -- -p 3001`, then open `http://localhost:3001`. |
| Login says "invalid" | Use the passwords in the table above. If you changed them during a previous run, use the new ones. |

---

## Optional: production-style run

```bash
npm run build
npm start
```

Use this if the panel wants to see the optimized build instead of dev mode.

---

## Appendix: using your own database instead

If you prefer your own PostgreSQL database, create one (e.g. free at
<https://neon.tech>) and pass it to the script:

```bash
npm run client:setup -- --database-url="postgresql://USER:PASSWORD@HOST/DB?sslmode=require"
```

The script will create the tables and seed the accounts on that database.

> A Vercel Blob store is only needed for visitor photos. Create a **private**
> Blob store at <https://vercel.com> → **Storage** → **Blob** if you want
> uploads to work.
