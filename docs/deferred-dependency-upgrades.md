# Deferred dependency upgrades — for Earth's call

Two breaking-semver upgrades surfaced 2026-05-19 in `npm audit`.
Both deliberately skipped during overnight autopilot per the
`autopilot-loop-playbook.md` STOP rule ("ambiguous decision needing
Earth"). Captured here so future-Earth (or future-Claude with
Earth's approval) has the context loaded.

---

## 1. `@anthropic-ai/sdk` 0.79–0.91 → 0.96 (server)

**Advisory:** [GHSA-p7fg-763f-g4gf](https://github.com/advisories/GHSA-p7fg-763f-g4gf)
— "Claude SDK for TypeScript has Insecure Default File Permissions
in Local Filesystem Memory Tool."

**Severity:** moderate

**Does it affect us?** Probably not directly. The vulnerability is
in the SDK's Memory Tool — a feature that writes/reads local files
as part of agent loops. We use the SDK for **one-shot draft
generation** (`server/src/lib/aiDrafts.js`) — no agent loops, no
memory tool. The dependency is exposed but the vulnerable path is
unreachable from our call sites.

**Why deferred:**
1. 0.96 is a breaking semver bump. Recent SDK versions have
   changed parameter shapes (e.g. `system` prompt structure,
   tool-use schema, content-block format). Any silent change
   could mean drafts come back malformed and we don't notice
   until Wave 5 audits run.
2. We have ~80 calls to the SDK across `lib/aiDrafts.js`,
   `mockAnthropic.js`, plus tests. Each needs verification post-
   upgrade.
3. Wave 5 outreach is active. A regression in draft quality
   between now and the first follow-up read of those audits would
   directly hurt the pipeline we just built.

**Recommended path:**
1. Wait for Wave 5 to land its first signal (~Sun 5/24).
2. Read the SDK 0.96 changelog vs whatever we're pinned to;
   identify any `messages.create` / tool-use API changes.
3. Upgrade in a branch, run the full server test suite
   (`mockAnthropic.test.js` + `aiDrafts.test.js` + the
   integration tests in `auditPreviews.test.js`).
4. Smoke-test a real draft generation against a known dental
   review (the PHI guardrails are the highest-risk regression
   surface — see `memory/feedback_dental_phi.md`).
5. Ship in a single PR titled `deps(server): @anthropic-ai/sdk
   0.79 → 0.96` so the decision and the verification live
   together in `git log`.

**Cost of waiting:** Low. We don't expose the Memory Tool. The
moderate-severity rating reflects code-paths nobody runs in our
deployment.

---

## 2. `vite` 5.x → 8.x (client) — via `esbuild` ≤0.24.2 advisory

**Advisory:** [GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99)
— "esbuild enables any website to send any requests to the
development server and read the response."

**Severity:** moderate

**Does it affect us?** Only the **dev server**. Production builds
of the client run on a static bundler output — there's no esbuild
dev server in the deployed artifact. The advisory matters for
developer laptops running `npm run dev` on an open WiFi network
with hostile peers. For Earth, working from home on a private
network, the realistic exploit surface is near-zero.

**Why deferred:**
1. CI was red until **earlier this same session** because of
   vite 5 / vitest 4 / esbuild peer-dep conflicts. We resolved
   it with `client/.npmrc` `legacy-peer-deps=true` and a careful
   Docker COPY ordering. Cycle 33 fix candidate (vite@8) is the
   exact upgrade path that re-opens that whole peer-dep saga.
2. Bumping vite past a major often changes Vitest's expected
   `transformMode` / `optimizeDeps` API. Our 170-test client
   suite would need re-verification.
3. The advisory only matters for the dev server, which production
   doesn't ship.

**Recommended path:**
1. Don't upgrade until vite 8 + vitest 4 stop being a moving
   target (vitest is the bigger pain — it's been on a vite-major
   chase for the last few releases).
2. When ready: branch, `cd client && rm -rf node_modules
   package-lock.json && echo > .npmrc && npm install vite@8`,
   then iterate on the peer-dep errors. Likely needs
   `vitest@<some-pin>`, possibly a `@vitest/coverage-*` bump,
   and a fresh CI run.
3. Verify the Docker build still works on Railway — last time
   the `.npmrc` ordering trip-up cost CI ~10 days of red.

**Cost of waiting:** Negligible. The advisory is dev-server only.
Earth's machine isn't on hostile WiFi.

---

## Why a separate doc?

Both decisions are large enough that they shouldn't sit buried in
the overnight log. Both are also too small to belong on the
`operating-queue.md` (they're not blocking anything). A standalone
doc means a future search for "anthropic SDK upgrade" or "vite 8"
finds the context in one place.

Update this doc when the situation changes (advisory patched in a
non-breaking way, a real exploit reported in the wild, our usage
pattern shifts to actually depend on the vulnerable code path).
