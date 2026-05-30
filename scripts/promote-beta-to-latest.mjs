#!/usr/bin/env node
/**
 * promote-beta-to-latest.mjs
 *
 * One-shot, auditable script to promote the current local package versions
 * from npm dist-tag `beta` to `latest`.
 *
 * Usage:
 *   node scripts/promote-beta-to-latest.mjs              # DRY RUN — verifies + prints plan, no writes
 *   node scripts/promote-beta-to-latest.mjs --apply      # actually runs `npm dist-tag add ... latest`
 *   node scripts/promote-beta-to-latest.mjs --apply --skip-tests   # skip unit + e2e (NOT recommended)
 *   node scripts/promote-beta-to-latest.mjs --apply --skip-e2e     # skip e2e only (unit still runs)
 *
 * Pre-flight checks (always run, abort on failure):
 *   1. `npm whoami` returns a value (else: not logged in)
 *   2. For each package:
 *      - Read local packages/<dir>/package.json -> name + version
 *      - `npm view <name> dist-tags --json` -> verify `beta` exists
 *      - Verify dist-tags.beta === local version (catches "bumped locally but never published")
 *      - Read current `latest` dist-tag; if equal to local already, skip (idempotent)
 *      - Sanity: local version must be valid semver and strictly > current latest (warn, don't block,
 *        in case of intentional revert)
 *   3. Unit tests pass (`npm test --workspaces --if-present`) unless --skip-tests
 *   4. E2E matrix passes (`npm run test:e2e`) unless --skip-e2e or --skip-tests
 *
 * Apply phase (only with --apply, after all checks green):
 *   For each package: `npm dist-tag add <name>@<version> latest`
 *   After all: re-pull dist-tags, assert each `latest` now equals the promoted version.
 *
 * Exit codes:
 *   0  success (dry-run completed OR apply completed and verified)
 *   1  pre-flight failure (login, mismatch, missing beta, etc.)
 *   2  test/e2e failure
 *   3  apply failure (dist-tag add exited non-zero or post-verify mismatch)
 */

import { readFile } from "node:fs/promises";
import { execSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const PACKAGES = [
  { dir: "shared", name: "@es-plus/shared" },
  { dir: "vue3", name: "@es-plus/vue3" },
  { dir: "vue2", name: "@es-plus/vue2" },
  { dir: "cli", name: "@es-plus/cli" },
  { dir: "mcp-server", name: "@es-plus/mcp-server" },
];

const args = new Set(process.argv.slice(2));
const APPLY = args.has("--apply");
const SKIP_TESTS = args.has("--skip-tests");
const SKIP_E2E = args.has("--skip-e2e") || SKIP_TESTS;

const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};
const log = (s) => process.stdout.write(s + "\n");
const ok = (s) => log(`${c.green}✓${c.reset} ${s}`);
const warn = (s) => log(`${c.yellow}!${c.reset} ${s}`);
const err = (s) => log(`${c.red}✗${c.reset} ${s}`);
const step = (s) => log(`\n${c.bold}${c.blue}━━ ${s}${c.reset}`);

function bail(code, msg) {
  err(msg);
  process.exit(code);
}

function runQuiet(cmd, opts = {}) {
  try {
    return execSync(cmd, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      ...opts,
    }).trim();
  } catch (e) {
    return { __error: true, code: e.status, stderr: (e.stderr || "").toString(), stdout: (e.stdout || "").toString() };
  }
}

function runStreaming(cmd, opts = {}) {
  // Use bash so the same script works on Windows git-bash + macOS + Linux CI.
  const r = spawnSync(cmd, {
    shell: true,
    stdio: "inherit",
    cwd: ROOT,
    ...opts,
  });
  return r.status === 0;
}

function cmpSemver(a, b) {
  // returns 1 if a > b, -1 if a < b, 0 if equal. Pre-release rules ignored — we only ship clean semver.
  const pa = a.split(/[-.+]/).slice(0, 3).map(Number);
  const pb = b.split(/[-.+]/).slice(0, 3).map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return 1;
    if ((pa[i] || 0) < (pb[i] || 0)) return -1;
  }
  return 0;
}

async function readLocalVersion(pkgDir) {
  const p = resolve(ROOT, "packages", pkgDir, "package.json");
  const json = JSON.parse(await readFile(p, "utf8"));
  return { name: json.name, version: json.version };
}

// ──────────────────────────────────────────────────────────────────────────────
// Banner
// ──────────────────────────────────────────────────────────────────────────────
log(`${c.bold}${c.cyan}@es-plus  beta → latest  promotion${c.reset}`);
log(`${c.dim}Mode: ${APPLY ? c.red + "APPLY" : c.green + "DRY-RUN"}${c.reset}`);
if (SKIP_TESTS) warn("Tests disabled (--skip-tests)");
else if (SKIP_E2E) warn("E2E disabled (--skip-e2e) — unit tests still run");

// ──────────────────────────────────────────────────────────────────────────────
// 1. npm whoami
// ──────────────────────────────────────────────────────────────────────────────
step("1. Verify npm login");
const who = runQuiet("npm whoami");
if (typeof who !== "string" || !who) {
  bail(1, "Not logged in to npm — run `npm login` first.");
}
ok(`Logged in as ${c.bold}${who}${c.reset}`);

// ──────────────────────────────────────────────────────────────────────────────
// 2. Pre-flight: local versions vs npm dist-tags
// ──────────────────────────────────────────────────────────────────────────────
step("2. Verify local versions match @beta on npm");

const plan = [];
for (const p of PACKAGES) {
  const local = await readLocalVersion(p.dir);
  if (local.name !== p.name) {
    bail(1, `${p.dir}/package.json name mismatch: expected ${p.name}, got ${local.name}`);
  }
  const tagsRaw = runQuiet(`npm view ${p.name} dist-tags --json`);
  if (typeof tagsRaw !== "string") {
    bail(1, `npm view ${p.name} failed: ${tagsRaw.stderr || "unknown"}`);
  }
  const tags = JSON.parse(tagsRaw);
  const currentLatest = tags.latest;
  const currentBeta = tags.beta;

  if (!currentBeta) {
    bail(1, `${p.name}: no @beta dist-tag on npm`);
  }
  if (currentBeta !== local.version) {
    bail(
      1,
      `${p.name}: local version ${local.version} ≠ npm @beta ${currentBeta}.\n  Either local is unpublished, or someone else pushed @beta. Run \`npm publish --tag beta\` first.`
    );
  }
  let action = "promote";
  let note = "";
  if (currentLatest === local.version) {
    action = "skip";
    note = "(already @latest — no-op)";
  } else if (currentLatest) {
    const cmp = cmpSemver(local.version, currentLatest);
    if (cmp < 0) {
      action = "downgrade";
      note = `(⚠ DOWNGRADE — current @latest is ${currentLatest}, newer than ${local.version})`;
    } else if (cmp === 0) {
      action = "skip";
      note = "(already @latest — no-op)";
    }
  }
  plan.push({ ...p, local: local.version, currentLatest, action, note });
}

log("");
log(`  ${c.bold}package${c.reset}`.padEnd(36) + `${c.bold}@latest now${c.reset}`.padEnd(20) + `${c.bold}→ becomes${c.reset}`.padEnd(20) + `${c.bold}action${c.reset}`);
log(`  ${"─".repeat(34)}  ${"─".repeat(18)}  ${"─".repeat(18)}  ${"─".repeat(20)}`);
for (const p of plan) {
  const colorAct =
    p.action === "promote" ? c.green :
    p.action === "skip"    ? c.dim   :
    /* downgrade */          c.yellow;
  log(
    "  " +
    p.name.padEnd(34) +
    "  " + (p.currentLatest || "(none)").padEnd(18) +
    "  " + p.local.padEnd(18) +
    "  " + colorAct + p.action.toUpperCase() + c.reset +
    (p.note ? " " + c.dim + p.note + c.reset : "")
  );
}

const toPromote = plan.filter((p) => p.action === "promote");
const downgrades = plan.filter((p) => p.action === "downgrade");

if (downgrades.length) {
  log("");
  warn(`${downgrades.length} package(s) would DOWNGRADE @latest. This is unusual.`);
  warn(`If intentional (rollback), re-run with --apply --allow-downgrade (flag not yet implemented — edit script).`);
  bail(1, "Aborting due to downgrade.");
}

if (toPromote.length === 0) {
  log("");
  ok("Nothing to promote — all packages already at @latest.");
  process.exit(0);
}

ok(`${toPromote.length} package(s) ready to promote.`);

// ──────────────────────────────────────────────────────────────────────────────
// 3. Unit tests
// ──────────────────────────────────────────────────────────────────────────────
if (!SKIP_TESTS) {
  step("3. Run unit tests (npm test --workspaces --if-present)");
  const passed = runStreaming("npm test --workspaces --if-present");
  if (!passed) bail(2, "Unit tests failed.");
  ok("Unit tests green.");
} else {
  step("3. Unit tests — SKIPPED");
}

// ──────────────────────────────────────────────────────────────────────────────
// 4. E2E matrix
// ──────────────────────────────────────────────────────────────────────────────
if (!SKIP_E2E) {
  step("4. Run E2E matrix (npm run test:e2e)");
  const passed = runStreaming("npm run test:e2e");
  if (!passed) bail(2, "E2E matrix failed.");
  ok("E2E matrix green.");
} else {
  step("4. E2E matrix — SKIPPED");
}

// ──────────────────────────────────────────────────────────────────────────────
// 5. Plan summary + apply gate
// ──────────────────────────────────────────────────────────────────────────────
step("5. Promotion plan");
log("");
log(`  Will run for each package:`);
log(`    ${c.cyan}npm dist-tag add <name>@<version> latest${c.reset}`);
log("");
for (const p of toPromote) {
  log(`    ${c.dim}$${c.reset} npm dist-tag add ${p.name}@${p.local} latest`);
}
log("");

if (!APPLY) {
  warn(`DRY-RUN — no changes made. Re-run with ${c.bold}--apply${c.reset} to execute.`);
  process.exit(0);
}

// ──────────────────────────────────────────────────────────────────────────────
// 6. Apply
// ──────────────────────────────────────────────────────────────────────────────
step("6. Applying dist-tag changes");
const failed = [];
for (const p of toPromote) {
  const out = runQuiet(`npm dist-tag add ${p.name}@${p.local} latest`);
  if (typeof out !== "string") {
    err(`${p.name}: ${out.stderr || "unknown error"}`);
    failed.push(p);
    continue;
  }
  ok(`${p.name}@${p.local} → latest`);
}
if (failed.length) {
  bail(3, `${failed.length} package(s) failed to promote: ${failed.map((p) => p.name).join(", ")}`);
}

// ──────────────────────────────────────────────────────────────────────────────
// 7. Post-verify (re-fetch dist-tags from registry)
// ──────────────────────────────────────────────────────────────────────────────
step("7. Verifying registry state");
const mismatches = [];
for (const p of toPromote) {
  const tagsRaw = runQuiet(`npm view ${p.name} dist-tags --json`);
  if (typeof tagsRaw !== "string") {
    err(`${p.name}: post-verify fetch failed`);
    mismatches.push(p);
    continue;
  }
  const tags = JSON.parse(tagsRaw);
  if (tags.latest !== p.local) {
    err(`${p.name}: expected @latest=${p.local}, got @latest=${tags.latest}`);
    mismatches.push(p);
    continue;
  }
  ok(`${p.name}  @latest = ${tags.latest}  @beta = ${tags.beta || "(none)"}`);
}
if (mismatches.length) {
  bail(3, `Registry verify failed for: ${mismatches.map((p) => p.name).join(", ")}`);
}

// ──────────────────────────────────────────────────────────────────────────────
// Done
// ──────────────────────────────────────────────────────────────────────────────
log("");
log(`${c.bold}${c.green}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}`);
log(`${c.bold}${c.green}  Promotion complete. ${toPromote.length} package(s) now @latest.${c.reset}`);
log(`${c.bold}${c.green}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}`);
log("");
log(`${c.dim}Tip: also bump GitHub Release notes + tweet/changelog announcement.${c.reset}`);
