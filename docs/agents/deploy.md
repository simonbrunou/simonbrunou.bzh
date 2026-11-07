# Deploy

This doc covers checking and queueing a production deploy, changing
application 4's settings or custom Docker options, and browser checks against
production.

## Operating production

Coolify (`coolify` and its Postgres `coolify-db`) runs in CT 104 and the site
container in CT 105, both on the Proxmox host 192.168.1.195. In Coolify the
site is application 4, uuid `q104frwri03kmi3jzid62x4g`. Each check below says
where it runs. "In CT 104" or "in CT 105" means a root shell inside that
container (`pct enter 104` or `pct enter 105` on the Proxmox host). If you
type those commands through `ssh` or `pct exec` instead, the host shell
parses their quotes and pipes first. "From a control host" means a host such
as sbrn, which has root ssh to the Proxmox host as `root@192.168.1.195`.
There the remote command sits in single quotes and any SQL goes in on stdin,
so only the Proxmox host's shell parses the command.

- **Latest deploys**, in CT 104:

  ```sh
  echo "select id,status,left(commit,8),created_at from application_deployment_queues where application_id='4' order by id desc limit 3;" |
    docker exec -i coolify-db psql -U coolify -d coolify -At -F "|"
  ```

  or from a control host:

  ```sh
  echo "select id,status,left(commit,8),created_at from application_deployment_queues where application_id='4' order by id desc limit 3;" |
    ssh root@192.168.1.195 'pct exec 104 -- docker exec -i coolify-db psql -U coolify -d coolify -At -F "|"'
  ```

  Each row reads `id|status|commit|created_at`, with `created_at` in UTC, for
  example `2592|finished|2c57f33e|2026-10-22 18:30:08`. A deploy's build log
  is its row's `logs` column, a JSON array of entries whose `output` holds
  each line.
- **Running container**, in CT 105:
  `docker ps --format "{{.Names}}|{{.Image}}|{{.Status}}"`, or from a control
  host:

  ```sh
  ssh root@192.168.1.195 'pct exec 105 -- docker ps --format "{{.Names}}|{{.Image}}|{{.Status}}"'
  ```

  CT 105 also runs Coolify's proxy, sentinel and buildkit containers. The
  site's container is named `<uuid>-<UTC timestamp>`, and its image tag is the
  full SHA of the deployed commit.
- **Wait for the deploy of a commit**, from a control host, with
  homelab-stacks' read-only `scripts/coolify-deploy-status.sh` (the clone at
  `~/Projects/homelab-stacks` on sbrn). Given the site's uuid and the merge
  commit's SHA, it checks that commit's deploy row, prints its key build-log
  lines, and checks that the container on CT 105 runs an image tagged with
  that SHA and is `healthy`:

  ```sh
  ~/Projects/homelab-stacks/scripts/coolify-deploy-status.sh q104frwri03kmi3jzid62x4g <sha>
  ```

  Its last line is the verdict: `OK` (exit 0), `FAIL` (exit 1) or `PENDING`
  (exit 3). `PENDING` means the deploy is still queued or in progress. To wait
  after a merge, rerun the script while it exits 3:

  ```sh
  sha=<sha>
  for i in $(seq 1 22); do
    sleep 20
    out=$(~/Projects/homelab-stacks/scripts/coolify-deploy-status.sh q104frwri03kmi3jzid62x4g "$sha")
    rc=$?
    [ "$rc" -ne 3 ] && break
  done
  printf '%s\n' "$out"; echo "exit $rc"
  ```

  The loop sleeps before its first check because Coolify queues the deploy a
  few seconds after the merge. Until then the script prints
  `FAIL: no deployment of <sha> for simonbrunou.bzh`. If the loop ends on that
  line right after a merge, run it again. The loop runs for at most 9 minutes,
  so give the command a 10-minute timeout. Since 2026-10-19 a deploy alone has
  taken 40 to 95 s. One queued behind another deploy took up to 144 s. A
  deploy still `PENDING` when the loop ends has run far longer than usual, so
  check the latest deploys and its build log before waiting longer.
- **Queue a deploy** of the current `main` with no new commit, for example
  after changing application 4's settings, which apply only on the next
  deploy. Do it the way the UI does: change application 4 through Coolify's
  PHP (its model and helpers), not with SQL. Save this as `deploy.php`:

  ```php
  $app = App\Models\Application::find(4);
  queue_application_deployment(application: $app, deployment_uuid: new_public_id(), force_rebuild: false);
  ```

  and pipe it into tinker in CT 104 (a file spares quoting the PHP's `$`):

  ```sh
  docker exec -i coolify sh -c 'cat > /tmp/x.php && php artisan tinker --execute="$(cat /tmp/x.php)"' < deploy.php
  ```

  The new row then shows in the latest deploys.
- **Browser checks against production** from the home LAN log one console
  error: its Pi-hole resolves `static.cloudflareinsights.com` (the Web
  Analytics beacon) to `0.0.0.0`, so the beacon fails with
  `ERR_CONNECTION_REFUSED`, not a CSP violation. For a clean console, start
  Chrome with `--host-resolver-rules="MAP static.cloudflareinsights.com <ip>"`,
  taking `<ip>` from `dig +short @1.1.1.1 static.cloudflareinsights.com`.

## Things that have bitten us

- **Coolify ignored the Dockerfile until 2026-10-19.** Its railpack build
  pack built the image without it, so production ran as root with every repo
  file inside. Application 4 now uses the Dockerfile build pack; keep it, or
  Dockerfile changes stop reaching production.
- **Coolify's health check host must be `127.0.0.1`.** Coolify runs its own
  `curl … || wget …` check inside the container instead of the Dockerfile
  `HEALTHCHECK`. In Alpine `localhost` resolves to `::1` first and the server
  listens on IPv4 `0.0.0.0` only, so a `localhost` check is refused and
  Coolify rolls the deploy back (deploy 2481). The image must also keep
  `curl` or `wget`; busybox `wget` is the one it has.
- **Coolify drops or mangles some custom Docker options.** Coolify 4.4.6
  turns the run options into compose keys and keeps only the flags it maps
  (`--cap-add`, `--cap-drop`, `--security-opt`, `--init`, `--ulimit` and a
  few more), without a warning. It also cuts most values at their first
  hyphen. So `--read-only` is dropped, and
  `--security-opt=no-new-privileges` becomes `security_opt: ["no"]`, an
  invalid value (#123). Before adding an option to application 4, check
  what Coolify makes of it in CT 104: `docker exec coolify php artisan
  tinker --execute="echo json_encode(convertDockerRunToCompose('<options>'));"`.
