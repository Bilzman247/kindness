# Truehost cPanel Deployment Guide for G-Squad (g-squad.buzz)
## Zero-Terminal & Low-Memory (CloudLinux LVE) Production Deployment

This guide explains how to deploy **G-Squad** to Truehost cPanel shared hosting **without using the command-line Terminal** and avoiding CloudLinux memory exhaustion (`RangeError: WebAssembly.instantiate(): Out of memory`).

---

### Why the Memory Error Happened & How This Fix Resolves It

1. **The Root Cause:**  
   CloudLinux enforces a strict **Virtual Memory (vMEM) address-space limit** (often 1GB–4GB) per cPanel account. When `next build` is executed on shared hosting without native Linux binaries installed, Next.js falls back to SWC WebAssembly (`@next/swc-wasm-nodejs`). The V8 WebAssembly engine tries to reserve a 4GB+ virtual memory region for safety guards, which CloudLinux blocks, throwing:  
   `RangeError: WebAssembly.instantiate(): Out of memory: Cannot allocate Wasm memory for new instance`.
   Additionally, parallel Webpack build workers and in-process TypeScript checks exceed the physical RAM (pMEM).

2. **The Solution:**  
   - The production Next.js assets (`.next/`) and server runner (`server.js`) are **pre-compiled**.
   - `server.ts` is compiled into a standalone, pure ES module `server.js` so Node.js runs it directly without `tsx`.
   - `next.config.mjs` has been tuned with `webpackMemoryOptimizations: true`, `productionBrowserSourceMaps: false`, single-worker mode (`cpus: 1`, `workerThreads: false`), and native Linux SWC bindings (`@next/swc-linux-x64-gnu`) in `optionalDependencies`.
   - At runtime, `node server.js` only consumes **~60MB–90MB of RAM**, which is well below CloudLinux shared hosting limits!

---

## Step-by-Step Deployment (No Terminal Required)

### Step 1: Upload the Pre-Built ZIP via cPanel File Manager

1. Log into your **Truehost cPanel**.
2. Open **File Manager** (under the **Files** section).
3. Create a folder in your home directory named `g-squad` (i.e. `/home/YOUR_USERNAME/g-squad`), or open your domain's root folder.
4. Click **Upload** in the top toolbar and upload:
   - `g-squad-cpanel-deploy.zip`
5. Once uploaded, right-click `g-squad-cpanel-deploy.zip` and select **Extract**.
6. Ensure the following files and folders exist directly in the `g-squad` directory:
   - `.next/` (Pre-compiled production build)
   - `public/` (PWA icons, manifest, favicon)
   - `server.js` (Compiled production startup file)
   - `package.json` (Configured with `"start": "node server.js"`)
   - `.env.example`
   - `next.config.mjs`

---

### Step 2: Configure "Setup Node.js App" in cPanel

1. In cPanel, navigate to the **Software** section and click **Setup Node.js App**.
2. Click **Create Application**:
   - **Node.js version:** Select `20.x` or `22.x` (LTS recommended).
   - **Application mode:** Select `Production`.
   - **Application root:** Enter `g-squad` (the folder where you extracted the ZIP).
   - **Application URL:** Select `g-squad.buzz` (or your subdomain).
   - **Application startup file:** Enter `server.js` *(IMPORTANT: Must be `server.js`, NOT `server.ts`)*.
3. Scroll down to **Environment variables** and click **Add Variable** for each of the following:

| Name | Value |
|---|---|
| `NODE_ENV` | `production` |
| `NEXT_PUBLIC_DERIV_APP_ID` | `33E1sj7WNaMsjg5MAxPyS` |
| `NEXT_PUBLIC_DERIV_APP_NAME` | `G-Squad` |
| `NEXT_PUBLIC_DERIV_ENV` | `production` |
| `NEXT_PUBLIC_DERIV_OAUTH_SCOPES` | `trade,account_manage` |
| `NEXT_PUBLIC_DERIV_REDIRECT_URI` | `https://g-squad.buzz` |
| `NEXT_PUBLIC_DERIV_REFERRAL_LINK` | `https://t.deriv.link?t=AJAQ5SJZLES4` |
| `NEXT_PUBLIC_DERIV_SHOW_APP_NAME` | `true` |

*(Note: cPanel Passenger automatically injects `PORT` for the application, so you do not need to hardcode a specific port).*

4. Click **Create** (or **Save**).

---

### Step 3: Install Production Dependencies (One Click in cPanel)

1. In the **Setup Node.js App** screen for your `g-squad` app, look at the top section.
2. Click the **Run NPM Install** button.
3. Wait 30–60 seconds while cPanel installs the production packages (`next`, `react`, `express`, `dotenv`, etc.).
   - *Note: Because the `.next` directory is already pre-built, you NEVER need to click or run `next build` on the server!*

---

### Step 4: Start / Restart the Application

1. Click **Start App** (or **Restart** if it is already running).
2. Visit `https://g-squad.buzz` in your browser.
3. You should see G-Squad running cleanly with:
   - Full Mobile & Desktop Dashboard
   - Deriv OAuth 2.0 Login & Token Exchange via `/api/deriv/token`
   - Real-time Account Balance & Live Ticks
   - Persistent Background Trading Bot Engine via `/api/bot/*`
   - PWA Install Banner & WebAPK integration

---

## How to Verify Health & Bot Status

- **Health Check:** `https://g-squad.buzz/api/health` → returns `{"status":"ok","app":"G-Squad",...}`
- **Bot Status:** `https://g-squad.buzz/api/bot/status` → returns the live status of the persistent trading engine.
- **PWA Service Worker:** `https://g-squad.buzz/sw.js` → validates mobile offline caching and install prompt.

---

## Ongoing Updates & Maintenance

Whenever you make changes to the app in the future:
1. Run `npm run build` in your development environment (where RAM limits are not an issue).
2. Upload the updated `.next/` folder and `server.js` to cPanel via File Manager.
3. Click **Restart** in **Setup Node.js App**.
