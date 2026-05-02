# Migration Guide: happy-english-club (New Supabase Project)

Migrating from old project `yxdcngazogqmrffllbkl` to new project **happy-english-club**  
Org: `ytgadwypaxoyolmvdpnj`  
Target domain: `english.synergylifelineconsulting.com`

---

## Step 1 — Create the New Supabase Project

1. Go to https://supabase.com/dashboard  
2. Click **New project**  
3. Fill in:
   - **Organization**: vintiz-dot's Org  
   - **Name**: `happy-english-club`  
   - **Database Password**: choose and save this securely  
   - **Region**: Southeast Asia (Singapore) — `ap-southeast-1`  
   - **Plan**: Free  
4. Click **Create new project** and wait ~2 minutes for provisioning  
5. Copy the **Project REF** (the short ID in the URL: `https://supabase.com/dashboard/project/<REF>`)

---

## Step 2 — Enable Email/Password Auth

1. In the new project dashboard → **Authentication → Providers**  
2. Ensure **Email** is enabled (it is by default)  
3. Under **Authentication → Email Templates**, confirm the templates are set  
4. Optional: disable "Confirm email" for development ease, or keep it on for production  

---

## Step 3 — Install Supabase CLI

**Windows (Scoop — recommended):**
```powershell
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

**Windows (npm — alternative):**
```powershell
npm install -g supabase
```

**Direct download:**  
https://github.com/supabase/cli/releases → download `supabase_windows_amd64.tar.gz`

Verify installation:
```bash
supabase --version
```

---

## Step 4 — Apply All 140 Migrations

### Option A: Supabase CLI (recommended)

```bash
# Login to Supabase
supabase login

# Run the setup script (replace with your actual values)
bash scripts/setup-new-supabase-project.sh <NEW_PROJECT_REF> <DB_PASSWORD>
```

This will:
1. Link the local repo to your new project  
2. Push all 140 migrations in order via `supabase db push`

### Option B: SQL Editor (fallback — no CLI needed)

1. Go to **SQL Editor** in the new project dashboard  
2. Open `scripts/combined_migrations.sql` (9,269 lines, all 140 migrations)  
3. Paste the entire content and click **Run**  

> Note: The SQL editor may time out on very large payloads. If it does, split the file
> and run in chunks — the migrations are separated by `-- ========================================` headers.

---

## Step 5 — Get New Project Credentials

In the Supabase dashboard → **Project Settings → API**:

| Field | Value |
|---|---|
| Project URL | `https://<NEW_REF>.supabase.co` |
| anon public key | `eyJhbGci...` (Project API Keys → anon public) |

---

## Step 6 — Update Local Files

Run the update script with your new credentials:

```bash
bash scripts/update-credentials.sh <NEW_PROJECT_REF> <ANON_KEY>
```

This updates both `.env` and `supabase/config.toml` automatically.

**Or manually edit `.env`:**
```env
SUPABASE_PUBLISHABLE_KEY="<NEW_ANON_KEY>"
SUPABASE_URL="https://<NEW_REF>.supabase.co"
VITE_SUPABASE_PROJECT_ID="<NEW_REF>"
VITE_SUPABASE_PUBLISHABLE_KEY="<NEW_ANON_KEY>"
VITE_SUPABASE_URL="https://<NEW_REF>.supabase.co"
```

**And `supabase/config.toml` line 1:**
```toml
project_id = "<NEW_REF>"
```

---

## Step 7 — Update GitHub Secrets

Go to: https://github.com/vintiz-dot/happy-class-mate/settings/secrets/actions

Update (or add) these two secrets:

| Secret Name | New Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://<NEW_REF>.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `<NEW_ANON_KEY>` |

---

## Step 8 — Push & Deploy

```bash
git add supabase/config.toml
git commit -m "chore: migrate to happy-english-club Supabase project"
git push origin main
```

The GitHub Actions workflow will build and deploy to `english.synergylifelineconsulting.com` automatically.

---

## RLS Policy Coverage Summary

All 140 migrations collectively define policies for all four app roles:

| Role | Coverage |
|---|---|
| **admin** | Full CRUD on all tables: families, students, teachers, classes, enrollments, sessions, attendance, payments, invoices, ledger, payroll, points, announcements, homework, journals |
| **teacher** | View all students; manage attendance/sessions for their classes; manage homework; view/update own profile and payroll; manage class economy and skill assessments |
| **student** | View own records; submit homework; manage own avatar, journal entries, enrollment requests; view class leaderboard and economy |
| **family** | View family records, students, invoices, payments, ledger entries, discount assignments, and referral bonuses |

**Auth trigger**: `on_auth_user_created` (in migration #1) auto-creates a `public.users` row from `auth.users` using `raw_user_meta_data->>'role'`.  
**Default role**: `student` if no role metadata is provided at signup.

---

## Files Created by This Setup

| File | Purpose |
|---|---|
| `scripts/combined_migrations.sql` | All 140 migrations concatenated for SQL editor use |
| `scripts/setup-new-supabase-project.sh` | CLI: link + `db push` in one command |
| `scripts/update-credentials.sh` | Updates `.env` and `config.toml` with new credentials |
| `scripts/MIGRATION_GUIDE.md` | This guide |
