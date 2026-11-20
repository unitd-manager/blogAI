# Auto-deploy (GitHub Actions)

Every push to `main` is **tested, built and deployed** to the server automatically.

```
push to main ─► npm test ─► npm run build ─► copy to server ─► restart app ─► health check
                   │                                                            │
             fails: nothing is deployed            fails: the previous version is put back automatically
```

- Workflow: [.github/workflows/deploy.yml](.github/workflows/deploy.yml)
- Server-side script: [scripts/remote-deploy.sh](scripts/remote-deploy.sh)
- Watch runs: GitHub → **Actions** tab. GitHub emails the person who pushed if a run fails.
- Manual deploy: Actions → **Test and deploy** → **Run workflow**.

Until the secrets below are added, pushes are only **tested** (the deploy step says "Deploy skipped").

---

## What the server needs (one time)

The app runs as **one Node.js process** (`node server/index.js`): it serves the API and the web page
from the same port, so no separate frontend upload is needed any more.

1. **Linux server** reachable over SSH, with `bash`, `tar`, `curl`.
2. **Node.js 20 or newer** (we test on 22) and npm.
3. **MySQL 5.7+** (same server or another one). The app creates and updates its own tables.
4. A **process manager** to keep the app running:
   - **pm2** (recommended): the script restarts the pm2 process named `DEPLOY_APP_NAME`
     (default `signalwrite`), or starts it the first time.
   - **systemd**: a service with the same name. The deploy user needs passwordless
     `sudo systemctl restart <name>`.
   - Anything else: set `DEPLOY_RESTART_COMMAND`.
5. The **app folder** (for example `/var/www/signalwrite`) with a filled-in **`.env`**
   (copy `.env.example`). Deploys never change or overwrite `.env`.
   Important settings in `.env` on the server:
   - `PORT` (the health check uses it), MySQL settings, `OPENAI_API_KEY`, `TAVILY_API_KEY`
   - `ADMIN_EMAILS` (your team: free access + Admin page), `PLAN_PRICE`, `SUBSCRIBE_CONTACT`
   - `TRUST_PROXY=1` if the app is behind a cloud load balancer (nginx on the same server: leave it out)
6. If nginx/Apache is in front: proxy the domain to `http://127.0.0.1:<PORT>`.

### Deploy SSH key (one time)

Create a key only for GitHub deploys (on any computer):

```bash
ssh-keygen -t ed25519 -C "github-deploy-signalwrite" -f signalwrite_deploy -N ""
```

- Add **`signalwrite_deploy.pub`** to the server: `~/.ssh/authorized_keys` of the deploy user.
- Put the **private** key `signalwrite_deploy` into the GitHub secret `DEPLOY_SSH_KEY` (below), then delete the file.
- The deploy user only needs write access to the app folder and permission to restart the app.

---

## GitHub secrets

Repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.
(Needs admin access to the repo. Never paste these into chat or commit them.)

| Secret | Required | Example | What it is |
|---|---|---|---|
| `DEPLOY_HOST` | yes | `203.0.113.10` | Server IP or hostname |
| `DEPLOY_PORT` | no | `22` | SSH port (default 22) |
| `DEPLOY_USER` | yes | `deploy` | SSH user |
| `DEPLOY_SSH_KEY` | yes | `-----BEGIN OPENSSH PRIVATE KEY-----…` | Private deploy key (whole file) |
| `DEPLOY_PATH` | yes | `/var/www/signalwrite` | App folder on the server (has `.env`) |
| `DEPLOY_APP_NAME` | no | `signalwrite` | pm2 process / systemd service name |
| `DEPLOY_RESTART_COMMAND` | no | `docker restart signalwrite` | Only if you don't use pm2/systemd |
| `DEPLOY_KNOWN_HOSTS` | no (recommended) | output of `ssh-keyscan -p 22 203.0.113.10` | Pins the server's SSH fingerprint |

---

## Switching from the current manual deploy

1. Add the secrets above.
2. Make sure the app folder has `.env`, and note the pm2/systemd name the app runs under today
   (`pm2 list` or `systemctl list-units | grep -i node`). Put that name in `DEPLOY_APP_NAME`.
3. If the web page was uploaded separately before (for example a `dist.zip` on another host):
   the Node app now serves the page itself, so point the domain at the Node app instead.
4. Push any commit (or use **Run workflow**) and watch the **Actions** tab.

## If a deploy fails

- Open the failed run in the **Actions** tab. Each step shows its log; the server part is prefixed `[deploy …]`.
- If the new version fails its health check, the script restores the previous version and restarts it,
  so the site keeps working. Fix the problem and push again.
- During a deploy the app restarts, so the site is unavailable for a few seconds.
