---
name: HTTP reliability hardening
overview: Ensure v0.1.43 behaves deterministically on HTTP for local workflows by centralizing UUID generation, hard-gating relay in insecure contexts, and preserving auth behavior.
todos:
  - id: ws1-uuid-module
    content: Add shared deterministic UUID utility with explicit precedence and fallback
    status: completed
  - id: ws2-callsite-migration
    content: Replace all direct crypto.randomUUID usage in owned browser call sites
    status: completed
  - id: ws3-bootstrap-alignment
    content: Align local-web bootstrap polyfill semantics with shared UUID utility
    status: completed
  - id: ws4-relay-gating
    content: Implement single-source relay capability gating by secure context
    status: completed
  - id: ws5-tests
    content: Execute explicit unit/integration/smoke matrix for HTTP and HTTPS
    status: completed
  - id: ws6-docs
    content: Document HTTP capabilities, relay limitation, and expected errors
    status: completed
isProject: false
---

# HTTP Reliability Hardening Plan (v0.1.43)

## Scope
- In scope:
  - Browser runtime behavior in [`D:/Git/vibe-kanban/packages/local-web`](D:/Git/vibe-kanban/packages/local-web), [`D:/Git/vibe-kanban/packages/web-core`](D:/Git/vibe-kanban/packages/web-core), and [`D:/Git/vibe-kanban/packages/remote-web`](D:/Git/vibe-kanban/packages/remote-web).
  - UUID generation reliability in insecure HTTP contexts.
  - Relay capability gating by secure-context detection.
  - Preserving auth availability on HTTP.
- Out of scope:
  - Full relay functionality on HTTP.
  - Server/API protocol changes.
  - Cryptographic-strength guarantees when only `Math.random` exists.

## Capability Contract (Normative)
- `isSecure = globalThis.isSecureContext === true`
- `relayAllowed = isSecure`
- `authAllowed = true`
- HTTP behavior (`isSecure === false`):
  - Relay must be unavailable across UI and runtime boundaries.
  - Auth must remain enabled.
- HTTPS behavior (`isSecure === true`):
  - Relay behavior unchanged from current baseline.

## Workstream 1: Shared UUID Utility
### Required files
- Add [`D:/Git/vibe-kanban/packages/web-core/src/shared/lib/uuid.ts`](D:/Git/vibe-kanban/packages/web-core/src/shared/lib/uuid.ts)

### Required API
- `uuidV4ForHttp(): string`
- `safeUUID(): string`

### Deterministic algorithm
- `safeUUID()` precedence (exact):
  1. If `isSecureContext === true` and `crypto.randomUUID` exists, return `crypto.randomUUID()`.
  2. Else return `uuidV4ForHttp()`.
- `uuidV4ForHttp()` precedence (exact):
  1. If `crypto.getRandomValues` exists, use it for 16 random bytes.
  2. Else generate 16 bytes via `Math.random`.
  3. Set RFC 4122 v4 bits:
     - byte 6: `(b[6] & 0x0f) | 0x40`
     - byte 8: `(b[8] & 0x3f) | 0x80`
  4. Return lowercase canonical format `8-4-4-4-12`.

### Acceptance criteria
- Helper is browser-only (`globalThis`), no Node APIs.
- Output always matches v4 UUID format and bit invariants.
- No extra branches, feature flags, or caller overrides.

## Workstream 2: Migrate UUID Call Sites
### Required migrations
- Replace direct `crypto.randomUUID()` with `safeUUID()` in:
  - [`D:/Git/vibe-kanban/packages/web-core/src/shared/integrations/electric/hooks.ts`](D:/Git/vibe-kanban/packages/web-core/src/shared/integrations/electric/hooks.ts)
  - [`D:/Git/vibe-kanban/packages/web-core/src/shared/hooks/useProjectWorkspaceCreateDraft.ts`](D:/Git/vibe-kanban/packages/web-core/src/shared/hooks/useProjectWorkspaceCreateDraft.ts)
  - [`D:/Git/vibe-kanban/packages/web-core/src/shared/lib/relayClientIdentity.ts`](D:/Git/vibe-kanban/packages/web-core/src/shared/lib/relayClientIdentity.ts)
  - [`D:/Git/vibe-kanban/packages/web-core/src/shared/dialogs/settings/settings/RemoteProjectsSettingsSection.tsx`](D:/Git/vibe-kanban/packages/web-core/src/shared/dialogs/settings/settings/RemoteProjectsSettingsSection.tsx)
  - [`D:/Git/vibe-kanban/packages/web-core/src/shared/lib/relaySigningSessionRefresh.ts`](D:/Git/vibe-kanban/packages/web-core/src/shared/lib/relaySigningSessionRefresh.ts)
  - [`D:/Git/vibe-kanban/packages/remote-web/src/shared/lib/webrtc/connection.ts`](D:/Git/vibe-kanban/packages/remote-web/src/shared/lib/webrtc/connection.ts)
  - [`D:/Git/vibe-kanban/packages/remote-web/src/shared/lib/relay/signing.ts`](D:/Git/vibe-kanban/packages/remote-web/src/shared/lib/relay/signing.ts)
- Refactor [`D:/Git/vibe-kanban/packages/web-core/src/shared/hooks/useAzureAttachments.ts`](D:/Git/vibe-kanban/packages/web-core/src/shared/hooks/useAzureAttachments.ts) to use shared helper.

### Acceptance criteria
- Repo search over first-party browser code shows no remaining direct `crypto.randomUUID(` usage in the listed files.
- No duplicate local UUID fallback implementations remain in migrated files.

## Workstream 3: Bootstrap Polyfill Alignment
### Required file
- [`D:/Git/vibe-kanban/packages/local-web/index.html`](D:/Git/vibe-kanban/packages/local-web/index.html)

### Required behavior
- Do not override native `crypto.randomUUID`.
- If missing, install a polyfill that matches Workstream 1 output semantics.
- Preserve compatibility for third-party direct `crypto.randomUUID` callers.

### Acceptance criteria
- On HTTP with missing native `randomUUID`, direct global calls return valid v4 UUIDs.
- Output format/bit behavior matches shared helper tests.

## Workstream 4: Relay Gating (Single Source of Truth)
### Ownership
- Create one canonical capability helper under [`D:/Git/vibe-kanban/packages/web-core/src/shared/lib`](D:/Git/vibe-kanban/packages/web-core/src/shared/lib) and require all relay UI/runtime checks to consume it.
- No duplicated `isSecureContext` business logic elsewhere.

### HTTP relay behavior (exact)
- Relay UI entry points are disabled or hidden.
- Runtime relay invocations short-circuit before crypto/network work.
- Stable runtime error contract:
  - code: `RELAY_REQUIRES_SECURE_CONTEXT`
  - message: `Relay is unavailable on HTTP. Use HTTPS to enable relay features.`

### Auth behavior (exact)
- Auth UI entry points remain enabled on HTTP and HTTPS.
- No relay gating should disable auth pathways.

### Acceptance criteria
- All relay entry points are gated by canonical helper.
- HTTP relay attempt always yields the exact code/message above.
- Auth flow remains reachable on HTTP.

## Workstream 5: Test Matrix (Mandatory)
### Unit tests
- UUID helper with `getRandomValues` available: v4 regex + bit checks.
- UUID helper without `getRandomValues`: v4 regex + bit checks.
- `safeUUID` precedence in:
  - secure context with native `randomUUID`,
  - insecure context with native `randomUUID`,
  - secure context without native `randomUUID`.

### Integration tests
- HTTP:
  - workspace draft creation succeeds.
  - Electric create/insert succeeds.
  - status add/create succeeds.
  - attachment temp ID generation succeeds.
  - relay invocation fails with `RELAY_REQUIRES_SECURE_CONTEXT`.
  - auth entry remains enabled.
- HTTPS:
  - relay entry and runtime behavior matches baseline.

### Smoke checks
- HTTP probe expectations:
  - `window.isSecureContext === false`
  - `typeof window.crypto === 'object'`
  - generated IDs pass v4 format checks.

### Acceptance criteria
- All listed tests pass.
- No HTTP runtime crash due to missing `crypto.randomUUID`.
- No HTTPS regression for relay-enabled behavior.

## Execution Governance (Mandatory)
### Required agent workflow
- For each workstream (`ws1` through `ws6`), implementation must follow this sequence:
  1. **Subagent implementer pass**: use a task-executor/general-purpose subagent to perform or validate the concrete implementation plan for that workstream.
  2. **Critical reviewer pass**: run a `critical-reviewer` subagent on the resulting diff/changes for that workstream.
  3. **Address reviewer findings**: resolve all high/critical findings before proceeding.
- No workstream may be marked complete without both passes.

### Agent assignment and prompt contract (mandatory)
- Every subagent invocation must include:
  - exact workstream ID (`ws1`..`ws6`),
  - exact in-scope file list for that step,
  - exact acceptance criteria subset being validated,
  - explicit out-of-scope constraints,
  - expected output format (findings list + pass/fail verdict).
- No “open-ended” prompts are allowed for implementation or review passes.
- If a prompt omits acceptance criteria, the step is invalid and must be rerun.

### Implementer subagent rubric
- Implementer pass must return:
  - changed files list,
  - per-file rationale tied to plan criteria,
  - self-check results against acceptance criteria,
  - unresolved risks/unknowns (if any).
- Implementer pass fails if:
  - it changes files outside declared scope without explicit justification,
  - it cannot map changes to acceptance criteria,
  - it leaves known blockers undocumented.

### Critical reviewer rubric
- Reviewer pass must classify findings by severity:
  - `critical`: security/data-loss/breaking contract regressions,
  - `high`: behavior mismatch vs plan criteria,
  - `medium`: maintainability/test gaps,
  - `low`: polish/non-blocking improvements.
- Reviewer pass must include:
  - exact file references,
  - explicit statement of violated criterion or risk,
  - required fix action.
- A workstream cannot pass with unresolved `critical` or `high` findings.

### Required subagent prompt templates
- Implementer template:
  - `Implement workstream <ws-id> only. In-scope files: <list>. Out-of-scope: <list>. Required criteria: <list>. Return: changes, criterion mapping, risks, pass/fail.`
- Reviewer template:
  - `Review workstream <ws-id> against criteria <list>. Verify scope boundaries and behavior contracts. Return severity-ranked findings with file refs, required fixes, and final pass/fail.`

### Required review artifacts
- Each workstream must record:
  - subagent summary of what changed,
  - reviewer findings (or explicit “no issues found”),
  - resolution notes for each non-trivial finding.

### Workstream completion gate
- A workstream is complete only when:
  - implementation is done,
  - reviewer pass completed,
  - all blocking findings resolved,
  - workstream acceptance criteria satisfied.

## Verification Gates (Release Blocking)
### Gate 1: Static and type checks
- Must pass repo checks relevant to touched surfaces with zero newly introduced errors.
- If any check fails, stop progression and fix before continuing.
- Minimum command gate (run after substantive code edits):
  - `pnpm run check`
  - `pnpm run lint`
  - `pnpm run format`
- Command outputs must be captured in verification notes (pass/fail + any remediations).

### Gate 2: HTTP behavior gate
- Mandatory pass of HTTP-focused matrix rows in Workstream 5:
  - UUID generation paths,
  - local workflow create/insert/status flows,
  - relay short-circuit with exact error contract,
  - auth still enabled.
- Any failure blocks completion.
- Required evidence:
  - explicit run logs/test outputs for each HTTP matrix row,
  - browser/context probe output for `isSecureContext` and crypto capability checks.

### Gate 3: HTTPS regression gate
- Mandatory pass of HTTPS relay baseline checks.
- Any relay regression on secure context blocks completion.
- Required evidence:
  - relay-enabled path verification logs in secure context,
  - confirmation that HTTP relay gating logic does not trigger in HTTPS mode.

### Gate 4: Reviewer sign-off gate
- Final `critical-reviewer` pass over aggregate changes must report no unresolved high-severity issues.
- Required evidence:
  - reviewer report attached with explicit final verdict: `PASS` or `FAIL`.

### Gate 5: Documentation parity gate
- Docs must match runtime behavior exactly for:
  - relay availability,
  - auth availability,
  - error code/message contract.
- Mismatch blocks completion.
- Required evidence:
  - docs diff references showing exact statements for relay/auth/error contract.

## Execution Checklist (Audit-Oriented)
- [ ] Each workstream used both implementer and critical-reviewer passes.
- [ ] Each subagent prompt included scope, criteria, out-of-scope, and output contract.
- [ ] No workstream closed with unresolved `critical`/`high` findings.
- [ ] Command gates (`check`, `lint`, `format`) passed after edits.
- [ ] HTTP and HTTPS verification evidence recorded per matrix row.
- [ ] Final reviewer aggregate verdict is `PASS`.
- [ ] Docs parity evidence recorded and matches runtime behavior.

## Workstream 6: Documentation
### Required updates
- Document HTTP mode as local-first with relay unavailable.
- Document HTTPS requirement for relay.
- Document UUID fallback precedence.
- Document expected relay error code/message on HTTP.

### Acceptance criteria
- Docs and runtime messaging use the same relay wording.
- No doc ambiguity about relay availability on HTTP.

## Risks and Mitigations
- Hidden third-party UUID usage:
  - Mitigation: keep bootstrap polyfill in local-web.
- Relay checks drift across codepaths:
  - Mitigation: single-source capability helper + required adoption.
- Weak-entropy environments:
  - Mitigation: accepted fallback policy with deterministic precedence.

## Definition of Done
- All workstream acceptance criteria are met.
- Test matrix passes in HTTP and HTTPS contexts.
- Relay is deterministically blocked on HTTP with stable error contract.
- Auth remains enabled on HTTP.
- Subagent + critical-reviewer workflow completed for each workstream.
- All verification gates passed with no unresolved blockers.