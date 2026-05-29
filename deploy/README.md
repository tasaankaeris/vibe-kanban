# Self-hosted Docker (fork GHCR images)

Two images are published to GHCR:

| Image | Role |
|-------|------|
| `ghcr.io/<owner>/vibe-kanban-cloud` | **Your** project system: Postgres, ElectricSQL sync, REST API, **remote-web UI**, auth |
| `ghcr.io/<owner>/vibe-kanban` | **Local agent server**: workspaces, chat, git, executors |

This is **not** Bloop’s hosted cloud. Nothing is sent to `vibekanban.com` unless you configure that yourself.

## Publishing images

Full design and evidence chain: [docs/fork-release-pipeline.md](../docs/fork-release-pipeline.md).

1. **Actions → Create pre-release tag** on `release/v0.1.43` (`tag_only` or `fork_patch`).
2. When the workflow succeeds, copy **`IMAGE_TAG`** from the job summary into `deploy/.env`.
3. `docker compose --env-file deploy/.env -f deploy/docker-compose.ghcr.yml pull && … up -d`.

Rebuild an existing tag: **Create pre-release tag** → `publish_existing` + `existing_tag`.

One GHCR tag per image, identical to the git tag (no `latest`, branch, or SHA tags). Legacy junk: optional **GHCR prune package versions** (see design doc).

## How it works locally (no Bloop SaaS)

```text
┌─────────────────────────────────────────────────────────────┐
│  Your machine / VPS                                           │
│                                                             │
│  ┌──────────────────┐      ┌──────────────────────────┐  │
│  │  cloud container │◄─────│  local container         │  │
│  │  (vibe-kanban-   │ HTTP │  (vibe-kanban)           │  │
│  │   cloud)         │      │  VK_SHARED_API_BASE=     │  │
│  │                  │      │    http://cloud:8081     │  │
│  │  • Postgres      │      │                          │  │
│  │  • ElectricSQL   │      │  • Workspaces / agents   │  │
│  │  • Issues/boards │      │  • Git under /repos      │  │
│  │  • Sign-in       │      │  • local-web UI          │  │
│  └────────┬─────────┘      └────────────┬─────────────┘  │
│           │                             │                 │
│     :3000 (cloud UI+API)          :3001 (use this)        │
└───────────┼─────────────────────────────┼─────────────────┘
            │                             │
       Browser ───────────────────────────┘
```

1. **cloud** stores organisations, projects, kanban columns, issues, comments (in **your** Postgres).
2. **local** runs coding agents against repos in `./repos` and calls **cloud** for project/issue data.
3. You use the app in the browser at **`http://localhost:3001`** (local UI). Sign in against **your** cloud container (bootstrap email/password or your own OAuth app pointing at `PUBLIC_BASE_URL`).

Upstream product name says “kanban”; the board UI is backed by **cloud**, not by the local image alone.

## Quick start

```bash
cp deploy/.env.example deploy/.env
# Edit: IMAGE_TAG (git tag from pre-release workflow), secrets, SELF_HOST_* or OAuth

docker login ghcr.io
mkdir -p deploy/repos   # git projects mounted into the local container

docker compose --env-file deploy/.env -f deploy/docker-compose.ghcr.yml up -d
# (paths in the compose file are relative to the deploy/ directory)
```

- App (boards + workspaces): **http://localhost:3001**
- Cloud API (health): **http://localhost:3000/v1/health**

## Agents in Docker

The local image does not include Claude Code / Codex / etc. Install them in a custom image layer or run agents on the host with `VK_SHARED_API_BASE` pointing at your cloud URL.

## Build from source instead of GHCR

See `crates/remote/docker-compose.yml` and root `Dockerfile`; `pnpm run remote:dev` for development.
