// PM2 process manager config (cross-platform — Linux, Windows, macOS).
//
//   npm i -g pm2
//   pm2 start deploy/pm2/ecosystem.config.cjs   # from the bundle root
//   pm2 logs acme-dashboard
//   pm2 save && pm2 startup                      # survive reboots
//
// Scale out by setting WEB_CONCURRENCY (e.g. WEB_CONCURRENCY=max) — PM2 runs
// the standalone server in cluster mode behind a shared port.

const path = require("node:path")

const instances = process.env.WEB_CONCURRENCY || 1

module.exports = {
  apps: [
    {
      name: "acme-dashboard",
      script: "server.js",
      cwd: path.join(__dirname, "..", ".."), // bundle root (where server.js lives)
      instances,
      exec_mode: instances === 1 ? "fork" : "cluster",
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT: process.env.PORT || 3000,
        HOSTNAME: process.env.HOSTNAME || "0.0.0.0",
      },
    },
  ],
}
