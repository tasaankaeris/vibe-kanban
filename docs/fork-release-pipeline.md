# Fork release pipeline (design)

Single documented path from `release/v0.1.43` to self-hosted deploy. All automation must follow this; no branch publishes to GHCR.

## Policy

| Rule | Enforcement |
|------|-------------|
| GHCR publish only on fork pre-release **git tags** | `docker-ghcr.yml`: `on.push.tags: v*` only; tag name regex |
| One Docker tag per image = git tag | `tags: ghcr.io/<owner>/<image>:${{ github.ref_name }}` — no `docker/metadata-action` |
| PRs do not push images | `push: false` on `pull_request` |
| `tag_only` does not push the branch | `pre-release-tag.yml`: push tag ref only |
| Downstream workflows use the **tag ref** | `gh workflow run … --ref "$tag"` (GITHUB_TOKEN tag push does not chain workflows) |

## Tag name

`v<upstream>-fork.<N>-<UTCYYYYMMDDHHmmss>` — example: `v0.1.43-fork.1-20260529072200`

- Semver body: `0.1.43-fork.1` in `package.json`
- Suffix: UTC timestamp (same idea as upstream pre-release tags)

## Operator flow

1. **Actions → Create pre-release tag** on `release/v0.1.43`
   - `tag_only` — tag current HEAD, publish
   - `fork_patch` — bump fork semver, commit, push branch, tag, publish
   - `publish_existing` — rebuild images + GitHub pre-release for an existing tag
2. Wait for workflow success (includes Docker GHCR verification step).
3. Copy `IMAGE_TAG` from job summary → `deploy/.env`.
4. `docker compose pull && up` (see `deploy/README.md`).

## Workflow graph

```text
Create pre-release tag (workflow_dispatch on release/*)
  ├─ tag_only: git tag → push tag only
  ├─ fork_patch: bump → commit → push branch → push tag
  └─ publish_existing: (no git writes)
        ↓
  gh workflow run docker-ghcr.yml --ref <tag>
  gh workflow run release-on-tag.yml --ref <tag>
        ↓
  Wait for Docker GHCR + verify logs (single image tag, no metadata-action)
        ↓
  GitHub pre-release + dist zip
```

## Evidence chain (how we know it works)

Each stage leaves auditable artifacts:

1. **Design** — this document + PR diff (no `metadata-action`, no branch `push` on docker-ghcr).
2. **PR CI** — Docker GHCR on PR: build only, `push: false`.
3. **Post-merge** — Create pre-release tag run log:
   - `git push origin <tag>` succeeds; no branch push on `tag_only`
   - Docker GHCR run for `headBranch=<tag>`: log contains `tags: ghcr.io/.../vibe-kanban:<tag>` and does not contain `metadata-action` or `:latest`
4. **Registry** — GHCR package version tags equal git tag only (optional: GHCR prune once for legacy junk).
5. **Deploy** — `docker pull ghcr.io/<owner>/vibe-kanban:<tag>` succeeds.

### Prior proof runs (before this PR’s tag workflow fix)

| Run | What it proves |
|-----|----------------|
| [26623943997](https://github.com/tasaankaeris/vibe-kanban/actions/runs/26623943997) | Merged docker-ghcr on tag `v0.1.43-fork.1-20260529072200`: single tag, no metadata-action |
| [26623969930](https://github.com/tasaankaeris/vibe-kanban/actions/runs/26623969930) | Prune removed legacy branch/sha/latest versions |
| [26623909544](https://github.com/tasaankaeris/vibe-kanban/actions/runs/26623909544) | **Failure mode**: `tag_only` pushed `HEAD` while branch moved — fixed in this PR |

### Failed approaches (do not repeat)

- Publish on `release/**` branch push → `release-v0.1.43`, SHA tags, storage churn.
- `docker/metadata-action` on tag builds → extra `latest`, semver aliases ([26604893369](https://github.com/tasaankaeris/vibe-kanban/actions/runs/26604893369)).
- `workflow_dispatch` on an **old** tag ref → runs workflow from old commit, not current `release`.

## GHCR cleanup (one-time)

**Actions → GHCR prune package versions** — optional housekeeping for versions created before this policy. Not part of the release path.
