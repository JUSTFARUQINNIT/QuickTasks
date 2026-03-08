# Host Backend on Render + 8am Reminders via cron-job.org

This guide covers:

1. Deploying the QuickTasks backend to **Render**
2. Configuring **cron-job.org** to call your reminder endpoint every day at 8am

---

## 1. Deploy Backend on Render

### 1.1 Create a Web Service

1. Go to [render.com](https://render.com) and sign in (or create an account).
2. **Dashboard** → **New** → **Web Service**.
3. Connect your Git repository (GitHub/GitLab) and select the **QuickTasks** repo.
4. Configure the service:
   - **Name:** e.g. `quicktasks-backend`
   - **Root Directory:** `Backend` (if your repo has Frontend + Backend; leave blank if Backend is the repo root)
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `node index.mjs`
   - **Instance Type:** Free (or paid if you need always-on)

### 1.2 Environment Variables on Render

In the Render dashboard: your service → **Environment** → add these (use your real values; do **not** commit them to Git):

| Key | Description | Example |
|-----|-------------|--------|
| `PORT` | Render sets this automatically; you can leave it unset or `8787` | `8787` |
| `NODE_ENV` | Optional | `production` |
| `SUPABASE_URL` | Your Supabase project URL | `https://xxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (from Supabase Dashboard → Settings → API) | `eyJ...` |
| `APP_URL` | Frontend URL (for password reset links) | `https://your-app.vercel.app` or `https://quick-tasks-eight.vercel.app` |
| `EMAIL_USER` | Gmail address for sending mail | `your@gmail.com` |
| `EMAIL_PASS` | Gmail App Password (not your normal password) | App password from Google Account |
| `MAIL_FROM` | Optional; sender name and email | `QuickTasks <your@gmail.com>` |
| `CRON_SECRET` | **Recommended.** Secret for cron-job.org to send in the request (see below) | e.g. a long random string |

- Get **Gmail App Password:** Google Account → Security → 2-Step Verification → App passwords → generate for “Mail”.
- **CRON_SECRET:** Generate a long random string (e.g. `openssl rand -hex 32`) and set it in Render; you’ll use the same value in cron-job.org.

### 1.3 Deploy

Click **Create Web Service**. Render will build and deploy. Note your backend URL, e.g.:

- `https://quicktasks-backend-xxxx.onrender.com`

Use this as the base URL in the next section.

---

## 2. Set Up cron-job.org (8am Daily Reminders)

cron-job.org will call your backend every day at 8am so users get email reminders for uncompleted/pending tasks, even if the Render instance is sleeping (e.g. on the free tier).

### 2.1 Create a cron-job.org Account

1. Go to [cron-job.org](https://cron-job.org) and sign up / sign in.

### 2.2 Create the Cron Job

1. **Cronjobs** → **Create cronjob**.
2. **Title:** e.g. `QuickTasks daily 8am reminders`.
3. **URL:**  
   `https://YOUR-RENDER-SERVICE.onrender.com/api/reminders/send-daily`  
   Replace with your actual Render URL (no trailing slash).
4. **Schedule:**  
   - **Every day** at **08:00** (or pick your timezone in cron-job.org).
5. **Request method:** `POST`.
6. **Request headers** (if you set `CRON_SECRET` in Render):
   - **Header name:** `x-cron-secret`
   - **Header value:** the same value as your `CRON_SECRET` env var on Render.
7. Save the cron job.

### 2.3 Timezone

In cron-job.org you can set the timezone for the job (e.g. **America/New_York**) so “08:00” is 8am in your chosen timezone.

### 2.4 Optional: Wake Render Before 8am

On Render’s free tier, the first request after idle can be slow (cold start). To have the reminder run at 8am sharp:

- Either use a paid instance (always on), or  
- Create a second cron-job.org job a few minutes **before** 8am that calls your root or health URL (e.g. `GET https://YOUR-RENDER-SERVICE.onrender.com/health`) to wake the service; then the 8am POST to `/api/reminders/send-daily` will run on a warm instance.

---

## 3. Summary

| What | Where |
|------|--------|
| Backend hosting | Render (Web Service) |
| 8am reminder trigger | cron-job.org → POST `/api/reminders/send-daily` |
| Secret for cron | `CRON_SECRET` on Render = header `x-cron-secret` on cron-job.org |

Your backend already accepts `POST /api/reminders/send-daily` and checks the `x-cron-secret` header when `CRON_SECRET` is set. After deploying on Render and creating the cron job, reminders will run every day at 8am (in the timezone you set in cron-job.org).
