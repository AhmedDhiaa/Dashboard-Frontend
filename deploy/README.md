# Deploying the dashboard

This bundle is a **self-contained Next.js standalone build**. It runs anywhere a
**Node.js 22+** runtime exists — Linux, Windows, macOS, IIS, Docker, a bare VM,
or a PaaS — with **no build step on the target**.

```
.                       ← bundle root
├── server.js           ← entry point:  node server.js
├── node_modules/       ← only the production deps Next traced
├── .next/static/       ← hashed client assets
├── public/             ← static files
├── web.config          ← IIS / Azure (Windows)
├── .env.example        ← copy to .env and fill in
├── publish.json        ← build manifest
└── deploy/             ← this folder
    ├── linux/   (start.sh, acme.service, nginx.conf)
    ├── pm2/     (ecosystem.config.cjs)
    └── windows/ (start.ps1, start.bat, install-service.ps1, web.config)
```

## 0. Configure

Copy `.env.example` → `.env` at the bundle root and set at least:

| Variable | Required | Notes |
| --- | --- | --- |
| `NEXTAUTH_SECRET` | ✅ | 32+ random bytes (`openssl rand -base64 32`). |
| `NEXTAUTH_URL` | ✅ (prod) | Public URL, e.g. `https://app.example.com`. |
| `NEXT_PUBLIC_API_URL` | – | Backend API origin. Omit to use mock mode. |
| `NEXT_PUBLIC_USE_MOCK_API` | – | `true` to run without a backend. |
| `NEXT_PUBLIC_MAP_PROVIDER` | – | `google` (needs key) or `leaflet` (free). |
| `PORT` / `HOSTNAME` | – | Default `3000` / `0.0.0.0`. |

## 1. Quick start (any OS)

```bash
# Linux / macOS
NODE_ENV=production node server.js
# Windows (PowerShell)
$env:NODE_ENV='production'; node server.js
```
Then open http://localhost:3000. The convenience scripts below load `.env` for you.

## 2. Linux

- **Foreground:** `./deploy/linux/start.sh`
- **systemd (recommended):** extract to `/opt/acme`, then follow the header of
  [`linux/acme.service`](linux/acme.service) — `systemctl enable --now acme`.
- **PM2:** `pm2 start deploy/pm2/ecosystem.config.cjs` (scale with `WEB_CONCURRENCY`).
- **Reverse proxy / TLS:** [`linux/nginx.conf`](linux/nginx.conf) terminates TLS
  and proxies to `127.0.0.1:3000`.

## 3. Windows

- **Foreground:** `deploy\windows\start.bat` or `pwsh deploy\windows\start.ps1`
- **Windows Service:** `pwsh deploy\windows\install-service.ps1` (uses [NSSM](https://nssm.cc)).
- **IIS / Azure App Service:** the bundle root `web.config` routes requests
  through `iisnode`. Point the IIS site at the bundle folder and set the app
  settings (secrets) in IIS/Azure config.

## 4. Docker

Use the repo's `Dockerfile` / `docker-compose.yml` (image build), or run this
bundle inside any `node:22` container: `COPY` it in and `CMD ["node","server.js"]`.

## 5. Health check

All deploys expose `GET /api/health` — wire it into your orchestrator's
liveness/readiness probe and your load balancer.
